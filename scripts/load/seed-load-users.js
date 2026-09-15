#!/usr/bin/env node
'use strict';

/**
 * prepare le pool d'utilisateurs du test de charge (sujet V.7).
 *
 * A lancer UNE fois avant la campagne : k6 ne se connecte pas pendant le ramp,
 * il reutilise les jwt ecrits ici. Sinon la montee en charge mesurerait surtout
 * bcrypt et le limiteur anti-bruteforce, pas l'application.
 *
 *   node scripts/load/seed-load-users.js [--users 20] [--api http://localhost:3000]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { markEmailVerified } = require('../lib/mark-email-verified');

const OUTPUT_FILE = path.join(__dirname, 'load-users.json');

function parseArgs(argv) {
    const args = { users: 20, api: process.env.API_URL || 'http://localhost:3000' };
    for (let i = 0; i < argv.length; i += 2) {
        const [flag, value] = [argv[i], argv[i + 1]];
        if (flag === '--users') args.users = Number(value);
        else if (flag === '--api') args.api = value;
        else throw new Error(`option inconnue : ${flag}`);
    }
    if (!Number.isInteger(args.users) || args.users < 1) throw new Error('--users doit etre un entier >= 1');
    return args;
}

function generatePassword() {
    // meme forme que scripts/seed-users.js : la validation du backend exige
    // minuscule + majuscule + chiffre + special
    return `Load${crypto.randomBytes(9).toString('base64url')}1!`;
}

async function api(apiUrl, pathName, { method = 'GET', token = null, body = null } = {}) {
    let res;
    try {
        res = await fetch(`${apiUrl}${pathName}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (err) {
        throw new Error(
            `Impossible de joindre le backend sur ${apiUrl} (${err.message}). ` +
                `Lance "make dev-back" dans un autre terminal.`,
        );
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * rejoue un appel tant que le limiteur repond 429. Le seeder est justement le
 * cas ou l'on veut attendre plutot que contourner : il tourne une fois, hors
 * campagne, et il n'y a aucune raison d'affaiblir la protection V.6 pour lui.
 * si THROTTLE_ALLOWLIST contient l'ip de la machine, aucune attente n'a lieu.
 */
async function withRetryOn429(label, call) {
    for (let attempt = 0; attempt < 12; attempt++) {
        const res = await call();
        if (res.status !== 429) return res;
        process.stdout.write(
            `  ${label} : limite anti-bruteforce atteinte, attente 60s...\n` +
                `  (pour eviter ces pauses : THROTTLE_ALLOWLIST=127.0.0.1 dans backend/.env, cf. docs/ramp-up.md)\n`,
        );
        await sleep(60_000);
    }
    throw new Error(`${label} : toujours limite apres 12 minutes, abandon.`);
}

async function createUser(apiUrl, index) {
    const suffix = crypto.randomBytes(4).toString('hex');
    const username = `load_${index}_${suffix}`;
    const email = `${username}@musicroom.local`;
    const password = generatePassword();

    const registered = await withRetryOn429(`register ${username}`, () =>
        api(apiUrl, '/auth/register', {
            method: 'POST',
            body: { username, email, password, passwordConfirm: password },
        }),
    );
    if (!registered.data?.access_token) {
        throw new Error(`register ${username} a echoue (${registered.status}) : ${JSON.stringify(registered.data)}`);
    }
    const token = registered.data.access_token;
    markEmailVerified(email);

    // une playlist par utilisateur : le scenario de lecture a besoin d'un id
    // reel, et le scenario d'ecriture d'une cible qui lui appartient.
    const playlist = await api(apiUrl, '/playlist-editor', {
        method: 'POST',
        token,
        body: { name: `Load test ${username}`, isPublic: true },
    });
    if (!playlist.data?.id) {
        throw new Error(`creation de playlist echouee (${playlist.status}) : ${JSON.stringify(playlist.data)}`);
    }

    return { username, email, password, token, playlistId: playlist.data.id };
}

async function main() {
    const { users, api: apiUrl } = parseArgs(process.argv.slice(2));

    if (fs.existsSync(OUTPUT_FILE)) {
        console.error(`${OUTPUT_FILE} existe deja. Supprime-le pour reseeder un pool neuf.`);
        process.exit(1);
    }

    console.log(`Creation de ${users} utilisateurs de charge sur ${apiUrl}...`);
    const pool = [];
    // sequentiel : en parallele on declenche le limiteur des le premier lot et
    // on passe la campagne a attendre.
    for (let i = 0; i < users; i++) {
        pool.push(await createUser(apiUrl, i));
        process.stdout.write(`\r  ${pool.length}/${users}`);
    }
    process.stdout.write('\n');

    fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(pool, null, 2)}\n`, { mode: 0o600 });
    console.log(`OK: pool ecrit dans ${OUTPUT_FILE} (JWT valides 7 jours).`);
    console.log('Lance ensuite : make load-test');
}

main().catch((err) => {
    console.error(`\nEchec: ${err.message}`);
    process.exit(1);
});
