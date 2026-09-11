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
  // Écoute en cours. Optionnel : les comptes créés avant l'ajout du champ n'ont
  // pas la clé, on retombe alors sur FRIENDS_ONLY (cf. LISTENING_VISIBILITY_DEFAULT).
  // Colonne simple-json, donc aucune migration nécessaire.
  listening?: Visibility;
}

// Seuls les amis interrogent déjà l'écoute en cours : le choix qui compte
// vraiment ici est PRIVATE, pour se rendre invisible même de ses amis.
export const LISTENING_VISIBILITY_DEFAULT = Visibility.FRIENDS_ONLY;

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
