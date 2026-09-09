import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Log } from './log.entity';
import { LogsService } from './logs.service';
import { LogsInterceptor } from './logs.interceptor';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * interceptor et filtre passent par APP_INTERCEPTOR / APP_FILTER au lieu de
 * main.ts : ils injectent LogsService, donc ils doivent etre construits par
 * nest. module global parce que LogsService sert partout.
 *
 * LogsInterceptor est aussi exporte : @nestjs/websockets construit son
 * InterceptorsContextCreator sans l'ApplicationConfig, donc un enhancer global
 * n'atteint jamais un @SubscribeMessage. les gateways s'y lient a la main.
 */
@Global()
@Module({
    imports: [TypeOrmModule.forFeature([Log])],
    providers: [
        LogsService,
        // useExisting et pas useClass : sinon APP_INTERCEPTOR a sa propre
        // instance et LogsInterceptor n'est injectable nulle part
        LogsInterceptor,
        { provide: APP_INTERCEPTOR, useExisting: LogsInterceptor },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
    exports: [LogsService, LogsInterceptor],
})
export class LogsModule {}
