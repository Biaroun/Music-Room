#!/usr/bin/env node
'use strict';

/**
 * campagne de montee en charge par paliers (sujet v.7).
 *
 * ecrit en node sans dependance : k6 est un binaire go a installer avec les
 * droits root, ce qui n'est pas toujours possible sur une machine d'ecole. Le
 * sujet dit "AB, Gatling, Siege, Tsung, JMeter for instance" : le choix de
 * l'outil est libre tant que la mesure est justifiee.
 *
 *   node scripts/load/seed-load-users.js --users 20   # une fois
 *   node scripts/load/run-load-test.js
 *
 * options : --steps 10,25,50,100  --duration 20  --api http://localhost:3001
 */

const fs = require('fs');
const path = require('path');

const POOL_FILE = path.join(__dirname, 'load-users.json');

const DEFAULTS = {
    api: process.env.API_URL || 'http://localhost:3001',
    steps: [10, 25, 50, 100, 200],
    duration: 20,      // secondes par palier
    think: 1000,       // pause entre deux iterations d'un meme utilisateur
};

// seuils au-dela desquels on considere le palier comme non tenu
const THRESHOLDS = { errorRate: 0.01, p95: 400, p99: 1000 };

function parseArgs(argv) {
    const args = { ...DEFAULTS };
    for (let i = 0; i < argv.length; i += 2) {
        const [flag, value] = [argv[i], argv[i + 1]];
        if (flag === '--api') args.api = value;
        else if (flag === '--steps') args.steps = value.split(',').map(Number);
        else if (flag === '--duration') args.duration = Number(value);
        else if (flag === '--think') args.think = Number(value);
        else throw new Error(`option inconnue : ${flag}`);
    }
    return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[index];
}

/**
 * une iteration = ce que fait un utilisateur qui ouvre l'app et navigue.
 * volontairement en lecture : c'est le profil majoritaire, et il n'ecrit rien
 * en base, donc la campagne est rejouable a l'identique.
 */
async function iteration(api, user, record) {
    const headers = {
        Authorization: `Bearer ${user.token}`,
        // memes en-tetes que l'app mobile (sujet V.6) : on veut passer par le
        // meme chemin d'ecriture de logs que du trafic reel
        'x-client-platform': 'android 14',
        'x-client-device': 'load generator',
        'x-client-app-version': '1.0.0',
    };

    const routes = [
        '/users/me',
        '/playlist-editor',
        `/playlist-editor/${user.playlistId}`,
        '/friendship/friends',
    ];

    for (const route of routes) {
        const start = process.hrtime.bigint();
        try {
            const res = await fetch(`${api}${route}`, { headers });
            const ms = Number(process.hrtime.bigint() - start) / 1e6;
            record(res.ok, ms, res.status);
        } catch {
            const ms = Number(process.hrtime.bigint() - start) / 1e6;
            record(false, ms, 0);
        }
    }
}

async function runStep(api, pool, vus, durationMs, thinkMs) {
    const latencies = [];
    let ok = 0;
    let ko = 0;
    const statuses = new Map();

    const record = (success, ms, status) => {
        latencies.push(ms);
        if (success) ok++;
        else {
            ko++;
            statuses.set(status, (statuses.get(status) ?? 0) + 1);
        }
    };

    const deadline = Date.now() + durationMs;
    const started = Date.now();

    // un worker par utilisateur simule ; le pool tourne si vus > pool.length
    const workers = Array.from({ length: vus }, (_, i) =>
        (async () => {
            const user = pool[i % pool.length];
            while (Date.now() < deadline) {
                await iteration(api, user, record);
                // un utilisateur reel ne rafraichit pas en boucle serree
                await sleep(thinkMs * (0.5 + Math.random()));
            }
        })(),
    );

    await Promise.all(workers);

    const elapsed = (Date.now() - started) / 1000;
    const sorted = [...latencies].sort((a, b) => a - b);
    const total = ok + ko;

    return {
        vus,
        requests: total,
        rps: total / elapsed,
        errorRate: total ? ko / total : 0,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        statuses,
    };
}

function holds(r) {
    return r.errorRate <= THRESHOLDS.errorRate && r.p95 <= THRESHOLDS.p95 && r.p99 <= THRESHOLDS.p99;
}

function row(r) {
    const cells = [
        String(r.vus).padStart(4),
        r.requests.toString().padStart(7),
        r.rps.toFixed(0).padStart(7),
        r.p50.toFixed(0).padStart(6),
        r.p95.toFixed(0).padStart(6),
        r.p99.toFixed(0).padStart(6),
        `${(r.errorRate * 100).toFixed(2)} %`.padStart(8),
        holds(r) ? '  tenu' : '  DEPASSE',
    ];
    return cells.join(' |');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(POOL_FILE)) {
        console.error(`Pool absent. Lance d'abord :\n  node scripts/load/seed-load-users.js --users 20`);
        process.exit(1);
    }
    const pool = JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));

    console.log(`Cible   : ${args.api}`);
    console.log(`Pool    : ${pool.length} utilisateurs`);
    console.log(`Paliers : ${args.steps.join(', ')} utilisateurs simultanes, ${args.duration}s chacun`);
    console.log(`Seuils  : erreurs < ${THRESHOLDS.errorRate * 100} %, p95 < ${THRESHOLDS.p95} ms, p99 < ${THRESHOLDS.p99} ms\n`);
    console.log(' VUs |   reqs |    rps |  p50 |  p95 |  p99 | erreurs | verdict');
    console.log('-----+--------+--------+------+------+------+---------+--------');

    const results = [];
    for (const vus of args.steps) {
        const r = await runStep(args.api, pool, vus, args.duration * 1000, args.think);
        results.push(r);
        console.log(row(r));
        if (r.statuses.size) {
            const detail = [...r.statuses.entries()].map(([s, n]) => `${s || 'reseau'}x${n}`).join(' ');
            console.log(`     ${' '.repeat(50)} (${detail})`);
        }
        // laisse le serveur redescendre entre deux paliers
        await sleep(2000);
    }

    const lastHolding = [...results].reverse().find(holds);
    console.log('');
    if (lastHolding) {
        console.log(`Capacite retenue : ${lastHolding.vus} utilisateurs simultanes`);
        console.log(`(dernier palier ou les trois seuils tiennent, a ${lastHolding.rps.toFixed(0)} req/s)`);
    } else {
        console.log('Aucun palier ne tient les seuils : baisse le premier palier ou revois les seuils.');
    }
    process.exit(lastHolding ? 0 : 1);
}

main().catch((err) => {
    console.error(`Echec: ${err.message}`);
    process.exit(1);
});
