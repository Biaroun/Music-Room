#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API_URL = process.env.API_URL || 'http://localhost:8081';
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

async function apiRequest(pathName, { method = 'GET', token = null, body = null } = {}) {
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
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(`${method} ${pathName} -> ${res.status}: ${msg || 'echec inconnu'}`);
  }
  return data;
}

async function createUser(spec) {
  const password = generatePassword();
  const { access_token: token } = await apiRequest('/auth/register', {
    method: 'POST',
    body: { username: spec.username, email: spec.email, password, passwordConfirm: password },
  });

  const me = await apiRequest('/users/me', { token });
  await apiRequest('/users/me', { method: 'PATCH', token, body: { avatar: spec.avatar } });

  return { ...spec, password, id: me.id, token };
}

async function befriend(a, b) {
  const request = await apiRequest(`/friendship/request/${b.id}`, { method: 'POST', token: a.token });
  await apiRequest(`/friendship/${request.id}/accept`, { method: 'PATCH', token: b.token });
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

async function main() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    console.error(`${CREDENTIALS_FILE} existe deja : ces users semblent deja seedes.`);
    console.error('Supprime ce fichier et les users correspondants en base pour reseeder.');
    process.exit(1);
  }

  const created = [];
  for (const spec of USERS) {
    console.log(`-> creation de ${spec.username}...`);
    try {
      created.push(await createUser(spec));
    } catch (err) {
      console.error(`echec sur ${spec.username}: ${err.message}`);
      if (created.length) {
        console.error(`users deja crees avant l'echec: ${created.map((u) => u.username).join(', ')}`);
        console.error("pas de suppression automatique (aucun endpoint DELETE user) - nettoyage manuel en base si besoin.");
      }
      process.exit(1);
    }
  }

  for (const [i, j] of PAIRS) {
    console.log(`-> amitie ${created[i].username} <-> ${created[j].username}...`);
    await befriend(created[i], created[j]);
  }

  writeCredentialsFile(created);
  console.log(`OK: 3 users crees et amis entre eux. Identifiants dans ${CREDENTIALS_FILE}`);
}

main();
