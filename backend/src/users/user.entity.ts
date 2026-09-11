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

// bonus VI.3 : pas de logique de paiement, juste la bascule d'etat. PREMIUM
// donne le droit de creer/gerer des track-vote events, FREE ne permet que d'y
// participer (rejoindre, voter).
export enum SubscriptionPlan {
  FREE = 'free',
  PREMIUM = 'premium',
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
  // ecoute en cours, optionnel : les comptes crees avant l'ajout du champ
  // n'ont pas la cle et retombent sur LISTENING_VISIBILITY_DEFAULT.
  // colonne simple-json, donc pas de migration
  listening?: Visibility;
}

// seuls les amis interrogent deja l'ecoute en cours : le choix qui compte ici
// est PRIVATE, pour se rendre invisible meme d'eux
export const LISTENING_VISIBILITY_DEFAULT = Visibility.FRIENDS_ONLY;

// ce qu'on garde d'un compte google, qu'il vienne du flux web ou d'un id token
export interface GoogleIdentity {
  googleId: string;
  email: string;
  username: string;
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

  @Column({ nullable: true, select: false})
  password: string;

  @Column({ type: 'enum', enum: OAuthProvider, default: OAuthProvider.LOCAL })
  oAuthProvider: OAuthProvider;

  // claim sub de google : stable, contrairement a l'email qui peut changer.
  // c'est lui qui retrouve un compte lie, l'email n'est affiche que pour l'ui
  @Column({ type: 'varchar', unique: true, nullable: true, select: false })
  googleId: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleEmail: string | null;

  @Column({ nullable: true })
  bio: string;

  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  @Column('simple-array', { nullable: true })
  musicpreferences: MusicGenre[];

  @Column('simple-json', { nullable: true })
  visibilitySettings: VisibilitySettings;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date | null;

  @Column({ type: 'varchar', nullable: true })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires: Date | null;

  @Column({ type: 'enum', enum: SubscriptionPlan, default: SubscriptionPlan.FREE })
  plan: SubscriptionPlan;

  @Column({ type: 'timestamp', nullable: true })
  subscribedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 
