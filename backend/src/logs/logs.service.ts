import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log, LogChannel } from './log.entity';
import type { ClientContext } from './client-context';

// everything we need to write one log
export type LogEntry = ClientContext & {
    channel: LogChannel;
    action: string;
    statusCode?: number | null;
    durationMs: number;
    success: boolean;
    error?: string | null;
    userId?: number | null;
    username?: string | null;
    ip?: string | null;
};

// write the logs in postgres and in the console
@Injectable()
export class LogsService {
    private readonly logger = new Logger('HTTP');

    constructor(@InjectRepository(Log) private readonly logs: Repository<Log>) {}

    /**
     * ecrit en base et en console, sans etre attendu : un log est une trace,
     * pas une etape de la requete. si postgres tousse, la requete passe quand
     * meme et le catch se contente de crier en console.
     */
    record(entry: LogEntry): void {
        this.print(entry);
        // no await on purpose (fire and forget)
        this.logs
            .insert({
                channel: entry.channel,
                action: entry.action,
                statusCode: entry.statusCode ?? null,
                durationMs: entry.durationMs,
                success: entry.success,
                error: entry.error ?? null,
                userId: entry.userId ?? null,
                username: entry.username ?? null,
                platform: entry.platform,
                device: entry.device,
                appVersion: entry.appVersion,
                ip: entry.ip ?? null,
            })
            .catch((err: unknown) => {
                this.logger.error(`log non persiste (${entry.action}): ${err instanceof Error ? err.message : err}`);
            });
    }

    // pretty console line (green arrow if ok cross if error)
    private print(entry: LogEntry): void {
        const who = entry.username ? `[user: ${entry.username}]` : '[anonymous]';
        // le triplet v.6, ou '-' quand l'appelant n'est pas l'app mobile
        const client = `[${entry.platform ?? '-'}/${entry.device ?? '-'}/${entry.appVersion ?? '-'}]`;
        const status = entry.statusCode != null ? ` - ${entry.statusCode}` : '';
        const line = `${entry.success ? '←' : '✗'} ${entry.action}${status} - ${entry.durationMs}ms ${who} ${client}`;
        if (entry.success) this.logger.log(line);
        else this.logger.warn(`${line}${entry.error ? ` - ${entry.error}` : ''}`);
    }
}
