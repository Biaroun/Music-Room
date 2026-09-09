import {
    APP_VERSION_HEADER,
    DEVICE_HEADER,
    PLATFORM_HEADER,
    clientContextFromHeaders,
    clientContextFromSocket,
} from './client-context';

describe('clientContext', () => {
    it('lit les en-tetes poses par le mobile', () => {
        expect(
            clientContextFromHeaders({
                [PLATFORM_HEADER]: 'ios',
                [DEVICE_HEADER]: 'iPhone 15',
                [APP_VERSION_HEADER]: '1.0.0',
            }),
        ).toEqual({ platform: 'ios', device: 'iPhone 15', appVersion: '1.0.0' });
    });

    it('renvoie null plutot que la chaine vide', () => {
        expect(clientContextFromHeaders({ [PLATFORM_HEADER]: '   ' }).platform).toBeNull();
    });

    // colonnes varchar : rien n'empeche un client de poster 10 ko
    it('tronque une valeur trop longue', () => {
        const context = clientContextFromHeaders({ [DEVICE_HEADER]: 'x'.repeat(500) });
        expect(context.device).toHaveLength(120);
    });

    it('prend la premiere valeur quand un en-tete arrive en double', () => {
        expect(clientContextFromHeaders({ [PLATFORM_HEADER]: ['android', 'web'] }).platform).toBe('android');
    });

    it('lit le triplet dans le payload d authentification du socket', () => {
        const client = {
            handshake: { auth: { token: 'jwt', platform: 'android', device: 'Pixel 7', appVersion: '1.0.0' } },
        } as any;
        expect(clientContextFromSocket(client)).toEqual({
            platform: 'android',
            device: 'Pixel 7',
            appVersion: '1.0.0',
        });
    });

    it('retombe sur les en-tetes du handshake quand auth ne porte rien', () => {
        const client = { handshake: { auth: { token: 'jwt' }, headers: { [PLATFORM_HEADER]: 'web' } } } as any;
        expect(clientContextFromSocket(client).platform).toBe('web');
    });

    it('ne casse pas sur un socket sans handshake', () => {
        expect(clientContextFromSocket(undefined)).toEqual({ platform: null, device: null, appVersion: null });
    });
});
