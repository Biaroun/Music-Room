import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
})
export class AppModule {}