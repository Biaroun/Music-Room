/**
 * campagne de montee en charge , sujet V.7 ("ramp-up").
 *
 * usage :
 *   node scripts/load/seed-load-users.js   # une fois, cree le pool
 *   make load-test                         # ou : k6 run scripts/load/k6-ramp-up.js
 *
 * variables :
 *   API_URL   cible                                  (defaut http://localhost:3000)
 *   PEAK_VUS  nombre d'utilisateurs simultanes vise   (defaut 200)
 *   STAGE     duree de chaque palier                  (defaut 1m)
 *
 * le pool de jwt vient de load-users.json : on ne se connecte pas pendant le
 * ramp, sinon la mesure porte surtout sur bcrypt et sur le limiteur V.6.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// config from the env (target peak users stage duration)
const API_URL = __ENV.API_URL || 'http://localhost:3000';
const PEAK_VUS = Number(__ENV.PEAK_VUS || 200);
const STAGE = __ENV.STAGE || '1m';

// SharedArray : le pool est parse une fois et partage par tous les vus, au lieu
// d'etre recopie dans chacun (a 200 vus la difference est en centaines de Mo).
const users = new SharedArray('users', () => JSON.parse(open('./load-users.json')));

// les en-tetes V.6 : la campagne doit ressembler a du trafic mobile reel, donc
// passer par le meme chemin d'ecriture de logs que l'application.
const CLIENT_HEADERS = {
    'x-client-platform': 'android 14',
    'x-client-device': 'k6 load generator',
    'x-client-app-version': '1.0.0',
};

// request params with the device headers + the jwt of this user
function headersFor(user) {
    return { headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` } };
}

// each VU get its own user (__VU start at 1 so minus 1 and modulo if more VUs than users)
function pickUser() {
    return users[(__VU - 1) % users.length];
}

// custom metric for the add track time (true = its a time in ms)
const editLatency = new Trend('playlist_edit_duration', true);

// deux modes exclusifs :
//  - campagne de charge (defaut), qui tourne avec THROTTLE_ALLOWLIST pose,
//    sinon on mesure le limiteur et pas l'application ;
//  - preuve anti-bruteforce V.6 (CHECK_THROTTLE=1), qui tourne allowlist vide.
//    les deux ensemble n'auraient pas de sens : un limiteur desactive ne peut
//    pas repondre 429. Voir docs/ramp-up.md.
const CHECK_THROTTLE = !!__ENV.CHECK_THROTTLE;

// paliers : chaque marche tient STAGE, ce qui laisse le temps de lire le point
// de rupture sur la courbe plutot que de le deviner entre deux mesures.
const rampScenarios = {
    browse: {
        executor: 'ramping-vus',
        exec: 'browse',
        startVUs: 0,
        stages: [
            // 10 25 50 then 100 percent of the peak held 2 stages then back to 0
            { duration: STAGE, target: Math.round(PEAK_VUS * 0.1) },
            { duration: STAGE, target: Math.round(PEAK_VUS * 0.25) },
            { duration: STAGE, target: Math.round(PEAK_VUS * 0.5) },
            { duration: STAGE, target: PEAK_VUS },
            { duration: STAGE, target: PEAK_VUS },
            { duration: '30s', target: 0 },
        ],
    },
    // L'ecriture reste minoritaire, comme dans l'usage reel : c'est elle qui
    // touche Postgres en ecriture et qui declenche les diffusions websocket.
    edit: {
        executor: 'ramping-vus',
        exec: 'edit',
        startVUs: 0,
        // edit start 1 stage later when some readers are already there
        startTime: STAGE,
        stages: [
            // 5 then 10 percent of the peak (at least 1 VU)
            { duration: STAGE, target: Math.max(1, Math.round(PEAK_VUS * 0.05)) },
            { duration: STAGE, target: Math.max(1, Math.round(PEAK_VUS * 0.1)) },
            { duration: STAGE, target: Math.max(1, Math.round(PEAK_VUS * 0.1)) },
            { duration: '30s', target: 0 },
        ],
    },
};

// 1 VU that try the bruteforce once
const throttleScenario = {
    brute_force: {
        executor: 'per-vu-iterations',
        exec: 'bruteForce',
        vus: 1,
        iterations: 1,
    },
};

// pick the scenario from CHECK_THROTTLE and the pass fail thresholds
export const options = {
    scenarios: CHECK_THROTTLE ? throttleScenario : rampScenarios,
    thresholds: CHECK_THROTTLE
        // throttle check = 99 percent checks ok sinon less than 1 percent errors + p95 p99 limits in ms
        ? { checks: ['rate>0.99'] }
        : {
              'http_req_failed{scenario:browse}': ['rate<0.01'],
              'http_req_failed{scenario:edit}': ['rate<0.01'],
              'http_req_duration{scenario:browse}': ['p(95)<400', 'p(99)<1000'],
              'http_req_duration{scenario:edit}': ['p(95)<800'],
              checks: ['rate>0.99'],
          },
};

/** lecture : le profil majoritaire (ouvrir l'app, parcourir ses playlists). */
export function browse() {
    const user = pickUser();
    const params = headersFor(user);

    const responses = http.batch([
        ['GET', `${API_URL}/users/me`, null, params],
        ['GET', `${API_URL}/playlist-editor`, null, params],
        ['GET', `${API_URL}/playlist-editor/${user.playlistId}`, null, params],
        ['GET', `${API_URL}/friendship/friends`, null, params],
    ]);

    check(responses[0], { 'GET /users/me → 200': (r) => r.status === 200 });
    check(responses[1], { 'GET /playlist-editor → 200': (r) => r.status === 200 });
    check(responses[2], { 'GET /playlist-editor/:id → 200': (r) => r.status === 200 });
    check(responses[3], { 'GET /friendship/friends → 200': (r) => r.status === 200 });

    // un utilisateur reel ne rafraichit pas en boucle serree.
    sleep(Math.random() * 3 + 1);
}

/**
 * ecriture : ajout puis retrait du meme morceau. La paire laisse la base dans
 * l'etat ou elle l'a trouvee, donc la campagne est rejouable sans nettoyage et
 * la taille des playlists ne derive pas pendant la mesure.
 */
export function edit() {
    const user = pickUser();
    const params = headersFor(user);
    // deezerId unique par VU et par iteration : addTrack refuse les doublons
    // dans une meme playlist (409).
    const deezerId = `load-${__VU}-${__ITER}`;

    const added = http.post(
        `${API_URL}/playlist-editor/${user.playlistId}/tracks`,
        JSON.stringify({
            deezerId,
            title: 'Load Test Track',
            artist: 'k6',
            previewUrl: 'https://example.invalid/preview.mp3',
        }),
        params,
    );
    editLatency.add(added.timings.duration);
    const created = check(added, { 'POST /tracks → 201': (r) => r.status === 201 });

    // delete only if the add worked (sinon no id)
    if (created) {
        const trackId = added.json('id');
        const removed = http.del(`${API_URL}/playlist-editor/${user.playlistId}/tracks/${trackId}`, null, params);
        check(removed, { 'DELETE /tracks/:id → 2xx': (r) => r.status >= 200 && r.status < 300 });
    }

    sleep(Math.random() * 2 + 1);
}

/**
 * preuve V.6 : au-dela de la limite, /auth/login doit repondre 429 et non
 * continuer a comparer des mots de passe.
 */
export function bruteForce() {
    // 15 tries against a limit of 5 per minute
    const attempts = 15;
    let throttled = 0;

    for (let i = 0; i < attempts; i++) {
        const res = http.post(
            `${API_URL}/auth/login`,
            JSON.stringify({ login: 'brute-force@musicroom.local', password: `wrong-${i}` }),
            { headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' }, tags: { name: 'auth-bruteforce' } },
        );
        // 429 = blocked by the throttler
        if (res.status === 429) throttled++;
    }

    check(throttled, {
        // 15 tentatives, limite a 5/min : au moins 10 doivent etre refusees
        // sans meme atteindre la comparaison de mot de passe.
        'le bruteforce sur /auth/login finit en 429': (count) => count >= attempts - 5,
    });
}
