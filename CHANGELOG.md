# Changelog

Toutes les évolutions notables du projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte le [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

## [1.0.0] - 2026-10-15

Première version complète, conforme au sujet Music Room.

### Ajouté

- **Comptes** : inscription e-mail / mot de passe, validation par mail, connexion par e-mail ou pseudo, mot de passe oublié avec formulaire de réinitialisation.
- **Google OAuth** : connexion web et mobile (PKCE, code à usage unique), liaison et déliaison d'un compte existant.
- **Profil** : visibilité par champ (public, amis, privé), goûts musicaux, avatars, modification de l'e-mail et du mot de passe.
- **Amis** : recherche d'utilisateurs, demandes, acceptation, refus, blocage, écoute en cours partagée en temps réel.
- **Music Track Vote** : événements publics / privés, invitations, licences `open`, `invite-only` et `geo-time-restricted`, import de playlist, file classée par votes diffusée en temps réel.
- **Music Playlist Editor** : playlists publiques / privées, licences d'édition, collaborateurs, ajout / suppression / réordonnancement en temps réel avec contrôle de version.
- **Recherche Deezer** et lecture d'extraits dans l'app.
- **Abonnement Free / Premium** (bonus VI.3) avec contrôle côté serveur.
- **Web responsive** (bonus VI.1).
- Adresse du backend réglable depuis l'application.
- Documentation Swagger générée automatiquement sur `/api/docs`.
- Journalisation de chaque action HTTP et WebSocket (plateforme, appareil, version de l'app).
- Rate limiting par IP, liste noire des JWT dans Redis, blocage des comptes non vérifiés.
- Scripts de comptes de test et campagne de montée en charge (600 utilisateurs simultanés).
- CI GitHub Actions : types, build, tests unitaires et e2e avec Postgres et Redis.

[Unreleased]: https://github.com/Biaroun/Music-Room/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Biaroun/Music-Room/releases/tag/v1.0.0
