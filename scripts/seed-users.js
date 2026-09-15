#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { markEmailVerified } = require('./lib/mark-email-verified');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const CREDENTIALS_FILE = path.join(__dirname, '..', 'backend', '.env.seed-users');

const USERS = [
  { username: 'seed_alice', email: 'seed.alice@musicroom.local', avatar: 'avatar-1' },
  { username: 'seed_bob', email: 'seed.bob@musicroom.local', avatar: 'avatar-2' },
  { username: 'seed_carol', email: 'seed.carol@musicroom.local', avatar: 'avatar-3' },
];

// paires d'index dans USERS a rendre amis (les 3 combinaisons possibles)
const PAIRS = [[0, 1], [0, 2], [1, 2]];

function generatePassword() {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = lower.toUpperCase();
  const digits = '0123456789';
  const special = '!@#$%^&*_-';
  const all = lower + upper + digits + special;
  const pick = (chars) => chars[crypto.randomInt(chars.length)];

  const chars = [pick(lower), pick(upper), pick(digits), pick(special)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiRequest(pathName, options = {}, attempt = 0) {
  const { method = 'GET', token = null, body = null } = options;
  let res;
  try {
    res = await fetch(`${API_URL}${pathName}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(
      `Impossible de joindre le backend sur ${API_URL} (${err.message}). ` +
      `Lance "make dev-back" dans un autre terminal, ou passe API_URL=http://localhost:<port> si le port a change.`
    );
  }

  const data = await res.json().catch(() => ({}));
  // login et register sont plafonnes a 5 essais par minute, on attend plutot que d'echouer
  if (res.status === 429 && attempt < 3) {
    console.log('   limite anti-bruteforce atteinte, attente 60s...');
    await sleep(60_000);
    return apiRequest(pathName, options, attempt + 1);
  }
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    const err = new Error(`${method} ${pathName} -> ${res.status}: ${msg || 'echec inconnu'}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// relit les mots de passe d'un seed precedent pour pouvoir relancer le script
function readKnownPasswords() {
  if (!fs.existsSync(CREDENTIALS_FILE)) return {};
  const passwords = {};
  let current = null;
  for (const line of fs.readFileSync(CREDENTIALS_FILE, 'utf8').split('\n')) {
    if (/^[^\s#]/.test(line)) current = line.trim();
    const match = line.match(/^\s+password:\s+(\S+)/);
    if (match && current) passwords[current] = match[1];
  }
  return passwords;
}

async function loginOrRegister(spec, knownPassword) {
  if (knownPassword) {
    try {
      const { access_token: token } = await apiRequest('/auth/login', {
        method: 'POST',
        body: { login: spec.email, password: knownPassword },
      });
      return { password: knownPassword, token, created: false };
    } catch (err) {
      if (err.status !== 401) throw err;
      // compte absent ou mot de passe change, on retombe sur la creation
    }
  }

  const password = generatePassword();
  try {
    const { access_token: token } = await apiRequest('/auth/register', {
      method: 'POST',
      body: { username: spec.username, email: spec.email, password, passwordConfirm: password },
    });
    return { password, token, created: true };
  } catch (err) {
    if (err.status === 409) {
      throw new Error(
        `${spec.username} existe deja en base mais son mot de passe n'est pas dans ${CREDENTIALS_FILE}. ` +
        `Supprime ce user en base (ou remets le bon fichier) puis relance.`
      );
    }
    throw err;
  }
}

async function seedUser(spec, knownPassword) {
  const { password, token, created } = await loginOrRegister(spec, knownPassword);
  markEmailVerified(spec.email);

  const me = await apiRequest('/users/me', { token });
  await apiRequest('/users/me', { method: 'PATCH', token, body: { avatar: spec.avatar } });

  return { ...spec, password, id: me.id, token, created };
}

async function befriend(a, b) {
  const friends = await apiRequest('/friendship/friends', { token: a.token });
  if (friends.some((f) => f.friendId === b.id)) return false;

  let request = null;
  try {
    request = await apiRequest(`/friendship/request/${b.id}`, { method: 'POST', token: a.token });
  } catch (err) {
    if (err.status !== 409) throw err;
  }
  if (request?.status === 'accepted') return true;

  // la demande de b vers a accepte celle en attente de a vers b
  await apiRequest(`/friendship/request/${a.id}`, { method: 'POST', token: b.token });
  return true;
}

function writeCredentialsFile(users) {
  const header =
    '# Comptes de test crees par `make seed-users` (scripts/seed-users.js).\n' +
    "# Pas un vrai .env (n'est pas destine a etre source) - juste des identifiants a copier pour te logger dans l'appli.\n\n";
  const body = users
    .map((u) => `${u.username}\n  email:    ${u.email}\n  password: ${u.password}\n  avatar:   ${u.avatar}`)
    .join('\n\n');
  fs.writeFileSync(CREDENTIALS_FILE, header + body + '\n', { mode: 0o600 });
}

// reecrit apres chaque user pour ne jamais perdre un mot de passe si ca plante en route
function saveCredentials(seeded, knownPasswords) {
  const users = USERS
    .map((spec) => seeded.find((u) => u.username === spec.username)
      || (knownPasswords[spec.username] && { ...spec, password: knownPasswords[spec.username] }))
    .filter(Boolean);
  writeCredentialsFile(users);
}

async function main() {
  const knownPasswords = readKnownPasswords();

  const seeded = [];
  for (const spec of USERS) {
    try {
      const user = await seedUser(spec, knownPasswords[spec.username]);
      console.log(`-> ${spec.username} ${user.created ? 'cree' : 'deja present, mis a jour'}`);
      seeded.push(user);
      saveCredentials(seeded, knownPasswords);
    } catch (err) {
      console.error(`echec sur ${spec.username}: ${err.message}`);
      process.exit(1);
    }
  }

  for (const [i, j] of PAIRS) {
    const done = await befriend(seeded[i], seeded[j]);
    console.log(`-> amitie ${seeded[i].username} <-> ${seeded[j].username} ${done ? 'creee' : 'deja en place'}`);
  }

  console.log(`OK: ${seeded.length} users prets et amis entre eux. Identifiants dans ${CREDENTIALS_FILE}`);
}

main().catch((err) => {
  console.error(`Echec: ${err.message}`);
  process.exit(1);
});
