# Music Room 🎵

Application mobile collaborative autour de la musique : vote en direct sur la file d'un événement et édition de playlists à plusieurs en temps réel.

- **Backend** : NestJS (TypeScript), PostgreSQL, Redis, Socket.IO
- **Mobile** : React Native / Expo (Android, iOS et web)
- **Services implémentés** : Music Track Vote et Music Playlist Editor (le sujet en demande 2 sur 3)

---

## Lancer le projet

### Prérequis

- Node.js 24 et npm
- Docker + Docker Compose (Postgres et Redis)
- Un émulateur Android, un simulateur iOS ou un navigateur

### Installation et démarrage

```bash
make install      # crée les .env depuis les modèles, puis npm install (backend + mobile)
make start        # lance Postgres + Redis (docker), le backend et Expo
make stop         # arrête tout
```

Pour lancer chaque partie séparément :

```bash
make docker-up    # Postgres (port 5433) + Redis (port 6380)
make dev-back     # backend sur http://localhost:3000
make dev-mobile   # Expo (Android / iOS)
make dev-web      # Expo dans le navigateur
```

Aucune bibliothèque tierce n'est commitée : tout s'installe via `npm install` depuis `package.json` (sujet IV.1).

### Configuration (`.env`)

`make install` copie `backend/.env.exemple` vers `backend/.env` s'il n'existe pas encore. Les fichiers `.env` sont ignorés par git : aucun identifiant n'est commité (sujet V.8).

| Variable | À quoi elle sert |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | Déjà alignées sur `docker-compose.yml` |
| `JWT_SECRET` | Secret de signature des tokens, à changer |
| `GOOGLE_CLIENT_ID_*`, `GOOGLE_CLIENT_SECRET_WEB` | Connexion Google : identifiants à créer dans la Google Cloud Console |
| `OAUTH_APP_REDIRECT` | Page de l'app vers laquelle le backend renvoie après une connexion Google |
| `MAIL_*` | Envoi des mails (voir ci-dessous) |
| `THROTTLE_*` | Limitation des requêtes (voir Sécurité) |

### Mails

Par défaut (`MAIL_HOST=ethereal`), les mails passent par [Ethereal](https://ethereal.email), un faux serveur SMTP de test. Rien n'arrive dans une vraie boîte : à chaque envoi, le backend affiche dans ses logs un **lien de prévisualisation** du mail. C'est ce lien qu'il faut ouvrir pour valider un compte ou réinitialiser un mot de passe.

- Avec `MAIL_USER` / `MAIL_PASSWORD` renseignés, la boîte Ethereal est fixe et consultable sur [ethereal.email/login](https://ethereal.email/login).
- Sans ces variables, une boîte jetable est créée à chaque démarrage ; son identifiant est affiché au lancement du backend.
- Pour un vrai fournisseur SMTP (Brevo, etc.), renseigner `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` et `MAIL_FROM`.

### Adresse du backend dans l'app (sujet V.5)

L'adresse du backend se change **depuis l'application**, via l'écran **Server** accessible depuis l'écran de connexion. L'app vérifie que l'adresse répond et que c'est bien l'API Music Room avant de l'enregistrer.

| Contexte | Adresse |
|---|---|
| Émulateur Android | `http://10.0.2.2:3000` (par défaut) |
| Navigateur / simulateur iOS | `http://localhost:3000` |
| Téléphone physique (même Wi-Fi) | `http://<IP_DE_LA_MACHINE>:3000` |

La valeur par défaut peut aussi être fixée au build avec `EXPO_PUBLIC_API_URL` dans `mobile/.env`.

> Si le port 3000 est déjà pris, le backend passe automatiquement au port suivant et l'affiche au démarrage.

### Comptes de test

```bash
make seed-users   # backend lancé au préalable
```

Crée trois comptes déjà vérifiés et amis entre eux (`seed_alice`, `seed_bob`, `seed_carol`). Les mots de passe sont générés aléatoirement et écrits dans `backend/.env.seed-users` (ignoré par git).

---

## Documentation de l'API (sujet V.4)

La documentation Swagger est générée automatiquement à partir du code : méthodes, entrées, sorties et codes de retour.

- Interface : **http://localhost:3000/api/docs**
- JSON OpenAPI : http://localhost:3000/api/docs-json

**REST + JSON** : REST s'appuie sur les verbes et codes HTTP standard, ce qui rend l'API lisible et facile à documenter et à tester (Swagger, curl). JSON est natif en JavaScript, des deux côtés. Le temps réel (votes, édition de playlist) passe en complément par **WebSocket (Socket.IO)**, sur le namespace `/realtime`, parce qu'en REST pur le client devrait interroger le serveur en boucle.

---

## Correspondance avec le sujet

### V.1 Utilisateur

| Exigence | Implémentation |
|---|---|
| Inscription mail / mot de passe | `POST /auth/register`, écran Register |
| Inscription / connexion par réseau social | Google (le sujet demande Facebook **ou** Google) : flux web `GET /auth/google/web` et token mobile `POST /auth/google/mobile` |
| Lier un compte existant à Google | `POST /auth/google/link-ticket` puis flux Google ; déliaison avec `DELETE /auth/google/link` |
| Validation du mail | Mail envoyé à l'inscription ; tant qu'il n'est pas validé, l'app n'affiche que l'écran de vérification (renvoi possible) |
| Mot de passe oublié | `POST /auth/forgot-password`, lien par mail vers un formulaire de réinitialisation |
| Profil : infos publiques, amis, privées, goûts musicaux | Chaque champ du profil a sa propre visibilité : public, amis seulement ou privé. Goûts musicaux choisis parmi une liste de genres. Système d'amis (demandes, acceptation) |

### V.2.1 Music Track Vote

- Chacun peut **proposer** un morceau ou importer une de ses playlists ; les morceaux les plus votés remontent dans la file et passent en premier.
- **Visibilité** : événement public par défaut, visible et votable par tous ; un événement privé n'est visible que des invités.
- **Licences** : `open` (tout le monde vote, par défaut), `invite-only` (seuls les invités votent), `geo-time-restricted` (seuls les utilisateurs présents dans une zone, définie par un point et un rayon, et pendant une plage horaire votent).
- **Concurrence** : un vote est une ligne unique (événement, votant, morceau) insérée avec `INSERT … ON CONFLICT DO NOTHING`. Deux votes simultanés ne peuvent ni se dupliquer ni s'écraser ; plusieurs personnes peuvent voter en même temps pour des morceaux différents ou pour le même. Le classement est recalculé côté serveur et diffusé à tous les participants.

### V.2.3 Music Playlist Editor

- **Visibilité** : playlist publique par défaut, accessible à tous ; une playlist privée n'est accessible qu'aux invités.
- **Licences** : `open` (tout le monde édite, par défaut) ou `invite-only` (seuls les invités éditent). La lecture et l'édition sont réglées séparément.
- **Temps réel** : une room Socket.IO par playlist ; chaque modification renvoie l'état complet à tous les éditeurs connectés.
- **Concurrence** : la playlist porte un numéro de version, incrémenté à chaque modification. Un déplacement de morceaux envoyé sur une version périmée est refusé (`playlist:conflict`) : seul son auteur reçoit l'état à jour, les autres ne voient rien changer.

### V.2.2 Music Control Delegation

Non implémenté : le sujet demande 2 services sur 3.

### V.3 Serveur

Toutes les données sont stockées côté backend (PostgreSQL), qui fait référence. L'app mobile ne fait que piloter l'API.

**Choix techniques :**

- **NestJS** : TypeScript sur le backend comme sur le mobile ; architecture en modules, injection de dépendances, génération de Swagger à partir des décorateurs.
- **PostgreSQL** : données relationnelles (utilisateurs, amis, playlists, votes) et contraintes d'unicité, sur lesquelles repose la gestion des votes simultanés.
- **Redis** : liste noire des tokens révoqués et état éphémère, comme le morceau en cours de lecture.
- **React Native / Expo** : un seul code pour Android, iOS et le web.

---

## Sécurité (sujet V.6)

| Risque | Protection |
|---|---|
| Accès aux données d'autrui | Routes protégées par JWT ; chaque accès est vérifié contre l'utilisateur connecté (propriétaire, invité, ami). Les champs de profil respectent leur visibilité |
| Bruteforce | Limitation par IP : 300 req/min sur toutes les routes, beaucoup moins sur les routes d'authentification. Le test e2e vérifie qu'après 5 échecs de connexion l'API répond `429` |
| Vol de session | Tokens JWT à durée limitée ; à la déconnexion, le token est placé en liste noire dans Redis (refusé en HTTP comme en WebSocket) |
| Mots de passe | Hachés avec bcrypt, jamais renvoyés par l'API |
| Injection / champs inattendus | Validation de toutes les entrées (`ValidationPipe` en mode `whitelist`), requêtes paramétrées via TypeORM |
| Redirection ouverte après la connexion Google | L'adresse de retour vient de la configuration, jamais de la requête ; le token passe dans le fragment de l'URL, donc n'apparaît pas dans les logs d'accès |
| Secrets | Uniquement dans des `.env` ignorés par git |

### Logs (sujet V.6)

Chaque action, requête HTTP comme message WebSocket, est enregistrée dans la table `log` avec la **plateforme**, l'**appareil** et la **version de l'app** (envoyés par l'app mobile dans les en-têtes `x-client-*`), plus l'utilisateur, le statut, la durée et l'IP.

```bash
docker compose exec postgres psql -U postgres -d musicroom \
  -c 'SELECT action, platform, device, "appVersion", "statusCode", "createdAt" FROM log ORDER BY id DESC LIMIT 20;'
```

---

## Montée en charge (sujet V.7)

Méthode, caractéristiques de la machine et résultats détaillés dans **[docs/ramp-up.md](docs/ramp-up.md)**.

**Résultat : 600 utilisateurs simultanés** (~1 500 req/s, 0 % d'erreur) sur un seul processus Node, avec un i9-13900H et 32 Go de RAM.

```bash
make load-seed    # crée le pool de comptes (voir la doc pour THROTTLE_ALLOWLIST)
make load-test    # campagne par paliers, en Node, sans dépendance à installer
```

---

## Qualité et intégration continue (sujet V.8)

```bash
make docker-up
make check        # types + build + tests unitaires + tests e2e (backend), types (mobile)
```

La CI GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) lance exactement la même chose à chaque push, avec un vrai Postgres et un vrai Redis.

---

## Bonus

| Bonus | État |
|---|---|
| VI.1 Multi-plateforme (web responsive) | ✅ La même app Expo tourne dans le navigateur (`make dev-web`). Le contenu est centré avec une largeur maximale sur grand écran, et les listes de playlists et d'événements passent en 2 colonnes au-delà de 700 px |
| VI.3 Abonnement gratuit / payant | ✅ Deux offres : **Free** (rejoindre les événements et voter) et **Premium** (créer et gérer des événements Track Vote). Bascule sans paiement depuis **Settings → Subscription**, ou via `POST /subscription/subscribe` / `POST /subscription/cancel`, avec un mail de confirmation. La restriction est vérifiée côté serveur : un compte Free qui crée un événement reçoit `403` |
| VI.2 IoT / iBeacon | ❌ Non implémenté. La géolocalisation sert uniquement à la licence « lieu + horaire » du vote |
| VI.4 Mode hors ligne | ❌ Non implémenté |

> Pour créer un événement Track Vote, il faut donc d'abord passer le compte en Premium.
