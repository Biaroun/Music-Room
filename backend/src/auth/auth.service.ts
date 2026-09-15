import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import {GoogleIdentity, OAuthProvider, Visibility} from '../users/user.entity';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import {JwtService} from "@nestjs/jwt";
import {LoginDto} from "./dto/login.dto";
import {MailService} from "../mail/mail.service";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import {ConfigService} from "@nestjs/config";

// google link ticket live 5 min
const GOOGLE_LINK_TICKET_TTL_MS = 5 * 60_000;

// all the auth logic (register login logout google reset password)
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private usersService: UsersService,
              private jwtservice: JwtService,
              private mailService: MailService,
              private config: ConfigService,
              @Inject(CACHE_MANAGER) private cacheManager: Cache,) {}

  // create the account send the verification mail and return a jwt
  async register(data: RegisterDto): Promise<{ access_token: string }> {
    if (await this.usersService.isAlreadyExist('email', data.email)) {
      throw new ConflictException('Email already exists');
    }
    if (await this.usersService.isAlreadyExist('username', data.username)) {
      throw new ConflictException('Username already exists');
    }
    // 10 = bcrypt salt rounds
    const hashedPassword = await bcrypt.hash(data.password, 10);
    // on vire passwordConfirm (not a column)
    const { passwordConfirm, ...userData} = data;
    const user = await this.usersService.create({
      ...userData,
      password: hashedPassword,
      visibilitySettings: {
        username: Visibility.PUBLIC,
        bio: Visibility.PUBLIC,
        musicPreferences: Visibility.PUBLIC,
      },
    });

    // le compte existe deja : si le mail part pas, on le log et l'app propose
    // de le renvoyer, plutot qu'un 500 sur un compte valide
    const tokenverif = await this.usersService.generateEmailVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(user.email, tokenverif)
      .catch((e) => this.logger.warn(`mail de verification non envoye a ${user.email} : ${e.message}`));
    return {
      access_token: this.jwtservice.sign({ sub: user.id, username: user.username }),
    };
  }

  // login with email or username then return a jwt
  async login(data: LoginDto): Promise<{ access_token: string }> {
    // a @ in the login = its an email (usernames cant have one)
    const isEmail = data.login.includes('@');

    let user;
    if (isEmail)
      user = await this.usersService.findByEmail(data.login);
    else
      user = await this.usersService.findByUsername(data.login);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // un compte cree par google n'a pas de mot de passe
    if (!user.password || !await bcrypt.compare(data.password, user.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return {
      access_token: this.jwtservice.sign({ sub: user.id, username: user.username }),
    };
  }

  // put the token in the redis blacklist until it expire
  async logout(token: string): Promise<void> {
    const payload = this.jwtservice.decode(token) as { exp: number };
    // seconds left before exp (exp is in seconds not ms)
    const ttl = payload.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await this.cacheManager.set(`blacklist:${token}`, true, ttl * 1000);
    }
  }

  // connexion google : compte deja lie, sinon compte a la meme adresse (google
  // prouve qu'elle lui appartient), sinon nouveau compte
  async handleGoogleUser(identity: GoogleIdentity): Promise<{ access_token: string }> {
    let user = await this.usersService.findByGoogleId(identity.googleId);

    if (!user) {
      user = await this.usersService.findByEmail(identity.email);
      if (user)
        await this.usersService.attachGoogle(user, identity);
    }

    if (!user) {
      user = await this.usersService.create({
        email: identity.email,
        username: await this.usersService.availableUsername(identity.username),
        oAuthProvider: OAuthProvider.GOOGLE,
        googleId: identity.googleId,
        googleEmail: identity.email,
        emailisVerified: true,
      });
    }

    return {
      access_token: this.jwtservice.sign({ sub: user.id, username: user.username }),
    };
  }

  // sujet v.1 : lier google a un compte existant. le jwt ne survit pas aux
  // redirections du navigateur, donc l'app demande d'abord ce ticket (jwt
  // requis), qui traverse google dans le parametre state. usage unique, 5 min,
  // et jamais le jwt lui-meme dans une url
  async createGoogleLinkTicket(userId: number): Promise<{ ticket: string }> {
    const ticket = randomBytes(24).toString('hex');
    await this.cacheManager.set(`google-link:${ticket}`, userId, GOOGLE_LINK_TICKET_TTL_MS);
    return { ticket };
  }

  // link the google account to the user who asked the ticket
  async linkGoogle(ticket: string, identity: GoogleIdentity): Promise<void> {
    const key = `google-link:${ticket}`;
    const userId = await this.cacheManager.get<number>(key);
    // delete right away so the ticket is single use
    await this.cacheManager.del(key);
    if (!userId)
      throw new BadRequestException('Link request expired, start again from the app');

    const owner = await this.usersService.findByGoogleId(identity.googleId);
    if (owner && owner.id !== userId)
      throw new ConflictException('This Google account is already linked to another Music Room account');

    const user = await this.usersService.findById(userId);
    if (!user)
      throw new UnauthorizedException();
    await this.usersService.attachGoogle(user, identity);
  }

  // remove the google link from the account
  async unlinkGoogle(userId: number): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user)
      throw new UnauthorizedException();
    // sans mot de passe, delier google enfermerait l'utilisateur dehors
    if (!user.password)
      throw new BadRequestException('Set a password first (forgot password), otherwise you could not log in anymore');
    await this.usersService.detachGoogle(userId);
    return { message: 'Google account unlinked' };
  }

  // check the google id token from the mobile app and extract the identity
  async verifyGoogleToken(token: string): Promise<GoogleIdentity> {
    const client = new OAuth2Client();

    // un id token porte l'audience du client qui l'a demande : android et ios
    // pour un build natif, web pour le flux navigateur d'expo-auth-session
    // (expo go et web). il faut donc accepter les trois.
    const audiences = [
      this.config.get<string>('GOOGLE_CLIENT_ID_ANDROID'),
      this.config.get<string>('GOOGLE_CLIENT_ID_IOS'),
      this.config.get<string>('GOOGLE_CLIENT_ID_WEB'),
    ].filter((id): id is string => !!id);

    if (!audiences.length) {
      throw new UnauthorizedException('Google sign-in is not configured on this server');
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: audiences,
    });

    const payload = ticket.getPayload();
    // une adresse non verifiee chez google ne prouve rien : on ne s'en sert pas
    // pour rattacher un compte existant
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Invalid Google token');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      // no name on google = on prend the part before the @
      username: payload.name ?? payload.email.split('@')[0],
    };
  }

  // send a reset mail if the account exist (same answer in both case)
  async forgot_password(email: string) {
    const user = await this.usersService.findByEmail(email);
    // unknown email = same message so we dont leak who has an account
    if (!user) {
      return { message: 'If this email exists, a reset link has been sent' };
    }
    // une erreur ici trahirait que le compte existe : on reste neutre
    const token = await this.usersService.generatePasswordResetToken(user.id);
    await this.mailService.sendPasswordResetEmail(user.email, token)
      .catch((e) => this.logger.warn(`mail de reset non envoye a ${user.email} : ${e.message}`));
    return { message: 'If this email exists, a reset link has been sent' };
  }

  // send a new verification mail (503 if the mail cant go)
  async resendVerification(userId: number): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user)
      throw new UnauthorizedException();
    if (user.emailisVerified)
      throw new BadRequestException('Email already verified');

    const token = await this.usersService.generateEmailVerificationToken(user.id);
    try {
      await this.mailService.sendVerificationEmail(user.email, token);
    } catch (e: any) {
      this.logger.warn(`renvoi du mail de verification rate pour ${user.email} : ${e.message}`);
      throw new ServiceUnavailableException('Email could not be sent, try again in a moment');
    }
    return { message: 'Verification email sent' };
  }

  // change the password with the token from the mail
  async resetPassword(token: string, newPassword: string) {
    const success = await this.usersService.verifyPasswordResetToken(token, newPassword);
    if (!success) {
      throw new BadRequestException('Invalid or expired token');
    }
    return { message: 'Password reset successfully' };
  }
}
