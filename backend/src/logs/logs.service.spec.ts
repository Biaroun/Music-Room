import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LogsService } from './logs.service';
import { Log, LogChannel } from './log.entity';

describe('LogsService', () => {
    let service: LogsService;
    let insert: jest.Mock;

    const entry = {
        channel: LogChannel.HTTP,
        action: 'POST /auth/login',
        statusCode: 201,
        durationMs: 12,
        success: true,
        userId: 7,
        username: 'alice',
        platform: 'android',
        device: 'Pixel 7',
        appVersion: '1.0.0',
        ip: '10.0.2.2',
    };

    beforeEach(async () => {
        insert = jest.fn().mockResolvedValue(undefined);
        const module: TestingModule = await Test.createTestingModule({
            providers: [LogsService, { provide: getRepositoryToken(Log), useValue: { insert } }],
        }).compile();

        service = module.get<LogsService>(LogsService);
    });

    it('persiste les trois informations exigees par V.6', () => {
        service.record(entry);

        expect(insert).toHaveBeenCalledTimes(1);
        expect(insert.mock.calls[0][0]).toMatchObject({
            platform: 'android',
            device: 'Pixel 7',
            appVersion: '1.0.0',
        });
    });

    it('met les colonnes client a null quand l appelant n est pas l app mobile', () => {
        service.record({ ...entry, platform: null, device: null, appVersion: null });

        expect(insert.mock.calls[0][0]).toMatchObject({ platform: null, device: null, appVersion: null });
    });

    // un log est une trace, pas une etape de la requete : si l'insert echoue,
    // l'utilisateur ne doit pas le voir
    it('n echoue pas quand la base refuse l insert', async () => {
        insert.mockRejectedValue(new Error('connection terminated'));

        expect(() => service.record(entry)).not.toThrow();
        await Promise.resolve();
    });
});
