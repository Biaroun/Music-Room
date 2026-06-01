import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OAuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook', // le sujet demande Facebook pas GitHub
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false })
  username: string;

  @Column({ unique: false, nullable: true })
  name: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ default: false })
  emailisVerified: boolean;

  @Column({ nullable: true })
  password: string;

  @Column({ type: 'enum', enum: OAuthProvider, default: OAuthProvider.LOCAL })
  oAuthProvider: OAuthProvider;

  @Column({ nullable: true })
  bio: string;

  @Column('simple-array', { nullable: true })
  musicpreferences: string[];

  @Column('simple-json', { nullable: true })
  visibilitySettings: {
    name: 'public' | 'friends-only' | 'private';
    bio: 'public' | 'friends-only' | 'private';
    musicPreferences: 'public' | 'friends-only' | 'private';
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
