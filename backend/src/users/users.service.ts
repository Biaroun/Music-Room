import {ConflictException, Injectable, UnauthorizedException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import {UpdateProfileDto} from "./dto/update-profile.dto";
import { randomBytes } from 'crypto';
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
        bio: true,
        avatar: true,
        musicpreferences: true,
        visibilitySettings: true,
        emailVerificationToken: true,
        emailVerificationExpires: true,
        plan: true,
        subscribedAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // q vide => on liste tout le monde (sauf soi), utilise par la page Amis pour
  // afficher les "inconnus" ; q rempli => filtre sur le username.
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

  async verifyPasswordResetToken(token: string, newpassword: string) {
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
