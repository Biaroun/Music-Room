import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import {UpdateProfileDto} from "./dto/update-profile.dto";
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { username } });
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
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

  async updateProfile(userID: number, data: UpdateProfileDto): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id: userID } });
    if (!user) {
      return null;
    }
    if (data.bio) {
      user.bio = data.bio;
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

  async generateEmailVerificationToken(userId: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });

    return token;
  }

  async verifyEmailToken(token: string): Promise<boolean> {
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
}
