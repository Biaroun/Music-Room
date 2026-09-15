'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

// pas de vraie boite mail pour les comptes de test, on les valide direct en base
// sinon le guard jwt les bloque avec un 403 email not verified
function markEmailVerified(email) {
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'musicroom',
      '-v', 'ON_ERROR_STOP=1', '-v', `email=${email}`],
    {
      cwd: path.join(__dirname, '..', '..'),
      input: `UPDATE "user" SET "emailisVerified" = true WHERE email = :'email';`,
      stdio: ['pipe', 'ignore', 'inherit'],
    }
  );
}

module.exports = { markEmailVerified };
