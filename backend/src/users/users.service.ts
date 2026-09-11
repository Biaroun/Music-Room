import {ConflictException, Injectable, UnauthorizedException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleIdentity, User } from './user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import {UpdateProfileDto} from "./dto/update-profile.dto";
import { randomBytes, randomInt } from 'crypto';
import {UpdateEmailDto} from "./dto/update-email.dto";
import * as bcrypt from "bcrypt";
import {MailService} from "../mail/mail.service";
import {UpdatePasswordDto} from "./dto/update-password.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private mailService: MailService
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      select: { id: true, username: true, email: true, password: true, emailisVerified: true, oAuthProvider: true }
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { username },
      select: { id: true, username: true, email: true, password: true, emailisVerified: true, oAuthProvider: true }});
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        emailisVerified: true,
        oAuthProvider: true,
        googleEmail: true,
        bio: true,
        avatar: true,
        musicpreferences: true,
        visibilitySettings: true,
        emailVerificationToken: true,
        emailVerificationExpires: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // q vide : liste tout le monde sauf soi, ce qui alimente les inconnus de la
  // page amis. q rempli : filtre sur le username
  async searchByUsername(query: string, excludeUserId: number): Promise<User[]> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .where('user.id != :excludeId', { excludeId: excludeUserId })
      .select(['user.id', 'user.username', 'user.avatar'])
      .orderBy('user.username', 'ASC')
      .limit(50);

    if (query) {
      qb.andWhere('LOWER(user.username) LIKE :q', { q: `%${query.toLowerCase()}%` });
    }

    return qb.getMany();
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    if (!googleId)
      return null;
    return await this.userRepository.findOne({ where: { googleId } });
  }

  // lie une identite google a un compte. si google prouve la meme adresse que
  // celle du compte, ca vaut validation du mail
  async attachGoogle(user: Pick<User, 'id' | 'email'>, identity: GoogleIdentity): Promise<void> {
    const sameEmail = !!user.email && user.email.toLowerCase() === identity.email.toLowerCase();
    await this.userRepository.update(user.id, {
      googleId: identity.googleId,
      googleEmail: identity.email,
      ...(sameEmail ? { emailisVerified: true } : {}),
    });
  }

  async detachGoogle(userId: number): Promise<void> {
    await this.userRepository.update(userId, { googleId: null, googleEmail: null });
  }

  // le nom affiche par google ("Bob Martin") ne respecte pas la regle des
  // usernames, et deux homonymes feraient sauter la contrainte unique
  async availableUsername(displayName: string): Promise<string> {
    const base = (displayName ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'user';

    let candidate = base;
    for (let i = 0; i < 5; i++) {
      if (!await this.isAlreadyExist('username', candidate))
        return candidate;
      candidate = `${base}_${randomInt(1000, 10000)}`;
    }
    return `${base}_${randomBytes(4).toString('hex')}`;
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return await this.userRepository.save(user);
  }

  async isAlreadyExist(
    field: 'email' | 'username',
    value: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { [field]: value },
    });
    return !!user;
  }

  async generateEmailVerificationToken(userId: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });

    return token;
  }

  async verifyEmailToken(token: string) {
    // sans ce garde, typeorm ignore la condition et renvoie le premier user
    if (!token)
      return false;
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token }
    });

    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return false;
    }

    user.emailisVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);

    return true;
  }

  async generatePasswordResetToken(userId: number){
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.userRepository.update(userId, {
      passwordResetToken: token,
      passwordResetExpires: expires,
    });

    return token;
  }

  // la page du lien mail verifie le token avant d'afficher le formulaire
  async isPasswordResetTokenValid(token: string): Promise<boolean> {
    if (!token)
      return false;
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token }
    });
    return !!user?.passwordResetExpires && user.passwordResetExpires >= new Date();
  }

  async verifyPasswordResetToken(token: string, newpassword: string) {
    if (!token)
      return false;
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token }
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return false;
    }

    await this.userRepository.update(user.id, {
      password: await bcrypt.hash(newpassword, 10),
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    return true;
  }

  async updateProfile(userId: number, data: UpdateProfileDto): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }
    if (data.bio) {
      user.bio = data.bio;
    }
    if (data.avatar !== undefined) {
      user.avatar = data.avatar === '' ? null : data.avatar;
    }
    if (data.musicpreferences) {
      user.musicpreferences = [...new Set(data.musicpreferences)];
    }
    if (data.visibilitySettings) {
      user.visibilitySettings = {
        ...user.visibilitySettings,
        ...data.visibilitySettings,
      };
    }
    return await this.userRepository.save(user);
  }

  async updateEmail(userId: number, data: UpdateEmailDto): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user)
      return null;

    if (!await bcrypt.compare(data.currentpassword, user.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (await this.isAlreadyExist('email', data.newemail)) {
      throw new ConflictException('Email already exists');
    }

    const tokenverif = await this.generateEmailVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(data.newemail, tokenverif);

    await this.userRepository.update(userId, {
      email: data.newemail,
      emailisVerified: false,
    });

    return await this.findById(userId);
  }

  async updatePassword(userId: number, data: UpdatePasswordDto): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }
    if (!await bcrypt.compare(data.currentpassword, user.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.userRepository.update(userId, {
      password: await bcrypt.hash(data.newpassword, 10),
    });

    return await this.findById(userId);
  }

}
