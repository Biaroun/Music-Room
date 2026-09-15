import { Throttle } from '@nestjs/throttler';

/**
 * sujet v.6 : la liste noire de jwt protege une session volee, pas la porte
 * d'entree. il faut plafonner les essais de mot de passe.
 *
 * pas configurable par variable d'environnement : les decorateurs sont evalues
 * avant que ConfigModule ait lu le .env, et une limite desactivable depuis
 * l'environnement n'en est plus une. pour le test de charge, voir
 * docs/ramp-up.md.
 */
export const AUTH_THROTTLE_TTL_MS = 60_000;
// max 5 tries per window
export const AUTH_THROTTLE_LIMIT = 5;

/** 5 essais par minute et par ip, sur les routes qui verifient un secret */
export const ThrottleAuth = () =>
    Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS } });
