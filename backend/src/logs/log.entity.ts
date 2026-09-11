import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// sujet v.6 : chaque action mobile laisse un log portant plateforme, appareil
// et version. les trois viennent du client, donc nullable : un curl n'envoie rien
export enum LogChannel {
    HTTP = 'http',
    REALTIME = 'realtime',
}

@Entity()
export class Log {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: LogChannel })
    channel: LogChannel;

    // 'POST /auth/login' en http, 'playlist:reorder' en websocket
    @Column()
    action: string;

    // null en websocket : un handler de gateway n'a pas de statut http
    @Column({ type: 'int', nullable: true })
    statusCode: number | null;

    @Column({ type: 'int' })
    durationMs: number;

    @Column({ type: 'boolean', default: true })
    success: boolean;

    @Column({ type: 'text', nullable: true })
    error: string | null;

    // pas de relation vers User : le log doit survivre a la suppression du
    // compte, et login/register n'ont pas d'utilisateur
    @Index()
    @Column({ type: 'int', nullable: true })
    userId: number | null;

    @Column({ type: 'varchar', nullable: true })
    username: string | null;

    // les trois informations exigees par v.6
    @Column({ type: 'varchar', nullable: true })
    platform: string | null;

    @Column({ type: 'varchar', nullable: true })
    device: string | null;

    @Column({ type: 'varchar', nullable: true })
    appVersion: string | null;

    @Column({ type: 'varchar', nullable: true })
    ip: string | null;

    @Index()
    @CreateDateColumn()
    createdAt: Date;
}
