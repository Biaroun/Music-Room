import { createHash, timingSafeEqual } from 'crypto';

export interface GoogleFlowState {
    redirect: string;
    challenge: string;
}

export const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
export const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

export function encodeFlowState(flow: GoogleFlowState): string {
    return Buffer.from(JSON.stringify({ r: flow.redirect, c: flow.challenge })).toString('base64url');
}

export function decodeFlowState(raw: unknown): GoogleFlowState | null {
    if (typeof raw !== 'string' || !raw)
        return null;
    try {
        const { r, c } = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
        if (typeof r !== 'string' || typeof c !== 'string' || !PKCE_CHALLENGE.test(c))
            return null;
        return { redirect: r, challenge: c };
    } catch {
        return null;
    }
}

export function verifierMatches(verifier: string, challenge: string): boolean {
    const hash = createHash('sha256').update(verifier).digest();
    const expected = Buffer.from(challenge, 'base64url');
    return expected.length === hash.length && timingSafeEqual(hash, expected);
}

export function isAllowedAppRedirect(redirect: unknown, allowedList: string | undefined): redirect is string {
    if (typeof redirect !== 'string' || redirect.includes('#'))
        return false;
    let url: URL;
    try {
        url = new URL(redirect);
    } catch {
        return false;
    }
    const web = url.protocol === 'http:' || url.protocol === 'https:';

    return (allowedList ?? '').split(',').map((entry) => entry.trim()).some((entry) => {
        const scheme = /^([a-z][a-z0-9+.-]*):\/\/$/i.exec(entry);
        if (scheme)
            return !web && url.protocol === `${scheme[1].toLowerCase()}:`;
        try {
            const allowed = new URL(entry);
            return web && allowed.origin === url.origin;
        } catch {
            return false;
        }
    });
}
