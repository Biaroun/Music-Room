import { decodeFlowState, encodeFlowState, isAllowedAppRedirect, verifierMatches } from './google-flow';

describe('google flow', () => {
    describe('isAllowedAppRedirect', () => {
        const allowed = 'http://localhost:8082, musicroom://, exp://';

        it.each([
            'http://localhost:8082',
            'http://localhost:8082/auth',
            'musicroom://auth',
            'exp://192.168.1.12:8081/--/auth',
        ])('accepte %s', (url) => {
            expect(isAllowedAppRedirect(url, allowed)).toBe(true);
        });

        it.each([
            'http://localhost:8082.evil.com',
            'http://localhost:80821',
            'https://localhost:8082',
            'http://evil.com',
            'evilapp://auth',
            'http://localhost:8082#code=x',
            'pas une url',
            42,
            undefined,
        ])('refuse %s', (url) => {
            expect(isAllowedAppRedirect(url, allowed)).toBe(false);
        });

        it('un schema web seul n\'autorise rien', () => {
            expect(isAllowedAppRedirect('https://evil.com', 'https://')).toBe(false);
        });

        it('sans configuration rien ne passe', () => {
            expect(isAllowedAppRedirect('http://localhost:8082', undefined)).toBe(false);
        });
    });

    describe('state', () => {
        const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

        it('fait l\'aller retour', () => {
            const flow = { redirect: 'exp://10.0.2.2:8081/--/auth', challenge };
            expect(decodeFlowState(encodeFlowState(flow))).toEqual(flow);
        });

        it.each([undefined, '', 'xxx', Buffer.from('{"r":"exp://a"}').toString('base64url')])(
            'rend null pour un state bricole (%s)',
            (raw) => expect(decodeFlowState(raw)).toBeNull(),
        );
    });

    describe('verifierMatches', () => {
        const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

        it('accepte le bon verifier', () => {
            expect(verifierMatches('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', challenge)).toBe(true);
        });

        it('refuse un autre verifier ou un challenge tronque', () => {
            expect(verifierMatches('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXX', challenge)).toBe(false);
            expect(verifierMatches('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', 'E9Mel')).toBe(false);
        });
    });
});
