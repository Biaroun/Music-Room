# Music Room 🎵

## Lancer le projet

### Backend
```bash
cd backend && npm install && npm run start:dev
```

### Mobile
```bash
cd mobile && npm install && npm start
```

---
### Mail (Mailtrap)
Le projet utilise [Mailtrap](https://mailtrap.io) en mode **Sandbox** pour tester l'envoi d'emails (vérification de compte) sans jamais envoyer de vrais mails à de vraies adresses.

1. Crée un compte gratuit sur [mailtrap.io](https://mailtrap.io)
2. Va dans **Sandboxes** (menu de gauche) → ouvre **My Sandbox** (créée par défaut)
3. Dans l'onglet **Integration**, choisis **SMTP**, tu trouveras :
  - `Host` → à mettre dans `MAIL_HOST`
  - `Port` → à mettre dans `MAIL_PORT` (utiliser `2525`)
  - `Username` → à mettre dans `MAIL_USER`
  - `Password` → à mettre dans `MAIL_PASSWORD`
4. Les emails de vérification envoyés par l'app n'arrivent jamais dans une vraie boîte mail — ils apparaissent directement dans l'inbox Mailtrap, pratique pour debug sans spammer personne.

## Accéder au backend depuis l'émulateur

L'URL du backend est configurable dans `mobile/src/config/api.ts` (exigence du sujet V.5).

| Contexte | URL à mettre dans `api.ts` |
|---|---|
| Émulateur Android | `http://10.0.2.2:3000` ← par défaut |
| Simulateur iOS | `http://localhost:3000` |
| Téléphone physique (même Wi-Fi) | `http://<IP_DE_TA_MACHINE>:3000` |

Pour trouver ton IP locale : `ip a` (Linux) ou `ifconfig` (Mac).

---

## Statut du projet

### ✅ Merge (terminé)
- **Setup architecture BACK** — serveur NestJS init, .env, .gitignore
- **Setup architecture FRONT** — routing React Native, URL backend configurable
- **[GLOBAL] Makefile** — dépendances installables via `npm install`

---

### 🔄 En cours

#### [BACK] create auth — *partiel*
- [x] API inscription / connexion (email + mdp)
- [ ] Envoi de mail pour validation de compte + mot de passe oublié
- [ ] API gestion du profil (Public / Amis / Privé / Goûts musicaux)

#### [FRONT] create auth — *partiel*
- [x] Écran connexion + inscription
- [ ] Écran mot de passe oublié
- [ ] Écran profil utilisateur

#### [DevOps] Sécurité, Documentation & Qualité — *en cours*
- [ ] Générer la doc API avec Swagger (méthodes, inputs, outputs)

---

### 📋 A Faire [BACK]
- **Music Track Vote**
  - [ ] API création d'event public / privé (sur invitation)
  - [ ] API submit un son et voter (gestion de la concurrence)
  - [ ] Système de licence (lieu / type d'invité)
- **Music Playlist Editor**
  - [ ] Setup WebSocket pour édition collaborative temps réel
  - [ ] API gestion des droits d'édition de la playlist
- **Sécurité**
  - [x] Système de logs par action mobile (plateforme / device / version)
  - [ ] Rate limiting (protection brute force)
  - [ ] Sécurisation des sessions JWT

---

### 📋 A Faire [FRONT]
- **Music Track Vote**
  - [ ] Écran liste des événements disponibles
  - [ ] Écran intérieur d'un event (playlist, vote, animation)
- **[FRONT + BACK] Social Login OAuth**
  - [ ] Intégration Google
  - [ ] Intégration Facebook

---

### 📋 Backlogs
- **[GLOBAL] Free / Premium** — système d'abonnement

---

### Bonus *(évalué seulement si la partie obligatoire est parfaite)*
- [ ] Mode hors ligne (cache + synchronisation)
- [ ] Interface responsive web
- [ ] IoT / IBeacon
- [ ] Free vs Paid subscription
