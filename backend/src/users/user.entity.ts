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
  FACEBOOK = 'facebook',
}


export enum MusicGenre {
  RAP = 'rap',
  RNB = 'rnb',
  ROCK = 'rock',
  POP = 'pop',
  JAZZ = 'jazz',
  CLASSICAL = 'classical',
  ELECTRO = 'electro',
  REGGAE = 'reggae',
  METAL = 'metal',
  COUNTRY = 'country',
}

export enum Visibility {
  PUBLIC = 'public',
  FRIENDS_ONLY = 'friends-only',
  PRIVATE = 'private',
}

export interface VisibilitySettings {
  username: Visibility;
  bio: Visibility;
  musicPreferences: Visibility;
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
  musicpreferences: MusicGenre[];

  @Column('simple-json', { nullable: true })
  visibilitySettings: VisibilitySettings;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date | null;
  
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 
