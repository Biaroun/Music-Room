import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrackVoteModule } from './track-vote/track-vote.module';
import { PlaylistEditorModule } from './playlist-editor/playlist-editor.module';
import { MusicDelegationModule } from './music-delegation/music-delegation.module';
import { LogsModule } from './logs/logs.module';
import { MailModule } from './mail/mail.module';
import { FriendshipModule } from './friendship/friendship.module';
import { ListeningModule } from './listening/listening.module';
import { HttpThrottlerGuard, isAllowlisted, throttleAllowlist } from './auth/guards/http-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    // sujet v.6 : plafond global par ip sur les routes http, les routes d'auth
    // etant bien plus serrees (voir ThrottleAuth). stockage en memoire, donc
    // valable tant qu'il n'y a qu'un processus (cf. docs/ramp-up.md)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const allowlist = throttleAllowlist(config.get<string>('THROTTLE_ALLOWLIST'));
        return {
          throttlers: [
            {
              name: 'default',
              ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60_000),
              limit: Number(config.get('THROTTLE_LIMIT') ?? 300),
            },
          ],
          skipIf: (context) => isAllowlisted(context, allowlist),
        };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(config.get<string>('REDIS_URL'))],
      }),
    }),
    AuthModule,
    UsersModule,
    TrackVoteModule,
    PlaylistEditorModule,
    MusicDelegationModule,
    LogsModule,
    MailModule,
    FriendshipModule,
    ListeningModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }],
})
export class AppModule {}