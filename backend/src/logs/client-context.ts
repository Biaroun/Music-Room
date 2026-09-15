import type { Socket } from 'socket.io';

/** les trois informations client exigees par v.6, telles qu'elles arrivent */
export type ClientContext = {
    platform: string | null;
    device: string | null;
    appVersion: string | null;
};

// when there is no headers at all
export const EMPTY_CLIENT_CONTEXT: ClientContext = { platform: null, device: null, appVersion: null };

// noms poses par mobile/src/config/device.ts : renommer d'un seul cote vide
// silencieusement les colonnes du log
export const PLATFORM_HEADER = 'x-client-platform';
export const DEVICE_HEADER = 'x-client-device';
export const APP_VERSION_HEADER = 'x-client-app-version';

// un header envoye deux fois arrive en tableau : on garde la premiere valeur.
// on tronque aussi, rien n'empeche un client de poster 10 ko de nom d'appareil
const MAX_LENGTH = 120;

// take the first value trim it and cut at MAX_LENGTH (null if empty)
function clean(value: unknown): string | null {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, MAX_LENGTH);
}

// read the 3 client headers of an http request
export function clientContextFromHeaders(headers: Record<string, unknown> | undefined): ClientContext {
    if (!headers) return EMPTY_CLIENT_CONTEXT;
    return {
        platform: clean(headers[PLATFORM_HEADER]),
        device: clean(headers[DEVICE_HEADER]),
        appVersion: clean(headers[APP_VERSION_HEADER]),
    };
}

/**
 * pas de header par message en websocket : le mobile met le triplet dans le
 * payload d'auth du handshake, a cote du token. repli sur les headers du
 * handshake pour un client qui n'aurait que ceux-la.
 */
export function clientContextFromSocket(client: Socket | undefined): ClientContext {
    const auth = client?.handshake?.auth as Record<string, unknown> | undefined;
    const fromAuth: ClientContext = {
        platform: clean(auth?.platform),
        device: clean(auth?.device),
        appVersion: clean(auth?.appVersion),
    };
    if (fromAuth.platform || fromAuth.device || fromAuth.appVersion) return fromAuth;
    return clientContextFromHeaders(client?.handshake?.headers as Record<string, unknown> | undefined);
}
