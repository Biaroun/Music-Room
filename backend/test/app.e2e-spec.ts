import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AUTH_THROTTLE_LIMIT } from './../src/auth/auth-throttle';

// remplace le test boilerplate de nest (GET / -> "Hello World!"), qui visait un
// AppController qui n'a jamais existe ici et restait donc rouge en permanence.
// demande postgres et redis lances : make docker-up
describe('Music Room (e2e)', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('refuse une route protegee sans token', () => {
        return request(app.getHttpServer()).get('/playlist-editor').expect(401);
    });

    it('refuse un mot de passe inconnu', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({ login: 'inconnu@musicroom.local', password: 'MauvaisMotDePasse1!' })
            .expect(401);
    });

    // sujet v.6 : le bruteforce doit taper un mur avant d'avoir pu essayer
    // beaucoup de mots de passe
    it('coupe le bruteforce sur /auth/login', async () => {
        const server = app.getHttpServer();
        const codes: number[] = [];

        for (let i = 0; i < AUTH_THROTTLE_LIMIT + 3; i++) {
            const res = await request(server)
                .post('/auth/login')
                .send({ login: 'bruteforce@musicroom.local', password: `faux-${i}` });
            codes.push(res.status);
        }

        expect(codes.slice(0, AUTH_THROTTLE_LIMIT)).toEqual(Array(AUTH_THROTTLE_LIMIT).fill(401));
        expect(codes.slice(AUTH_THROTTLE_LIMIT)).toEqual([429, 429, 429]);
    });
});
