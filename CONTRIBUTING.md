# Contribuer à Music Room

## Mise en place

```bash
make install
make docker-up
make dev-back      # dans un terminal
make dev-mobile    # dans un autre
```

Node.js 24 est requis (`nvm use` lit le fichier `.nvmrc`).

## Branches

- `main` est toujours stable et passe la CI.
- Une branche par fonctionnalité ou correctif, créée depuis `main` :
  - `feat/<sujet>` : nouvelle fonctionnalité (ex. `feat/playlist-editor-realtime`)
  - `fix/<sujet>` : correction de bug
  - `docs/<sujet>`, `refactor/<sujet>`, `test/<sujet>`, `chore/<sujet>`

## Commits

Les messages suivent [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
<type>(<portée>): <description courte>
```

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `refactor` | Refonte sans changement de comportement |
| `test` | Ajout ou correction de tests |
| `style` | Formatage, commentaires |
| `chore` | Outillage, dépendances, CI |

Portées courantes : `auth`, `users`, `friendship`, `track-vote`, `playlist`, `realtime`, `logs`, `mobile`, `ci`.

```
feat(playlist): ajoute le mode de licence invite-only
fix(auth): bloque les comptes non verifies sur les routes protegees
```

## Avant d'ouvrir une Pull Request

```bash
make check   # types + build + tests unitaires + e2e (backend), types (mobile)
```

- La CI doit être verte.
- Mettre à jour la documentation (README, Swagger, `docs/`) si le comportement change.
- Ajouter une ligne dans la section `[Unreleased]` du [CHANGELOG](CHANGELOG.md).
- Ne jamais commiter de secret : les `.env` sont ignorés par git, seuls les modèles (`.env.exemple`, `.env.example`) sont versionnés.

## Versions et tags

Le projet suit le [Semantic Versioning](https://semver.org/lang/fr/) (`MAJEUR.MINEUR.CORRECTIF`). Pour publier une version :

1. Déplacer le contenu de `[Unreleased]` dans une nouvelle section `[x.y.z] - AAAA-MM-JJ` du CHANGELOG.
2. Mettre à jour `version` dans `backend/package.json`, `mobile/package.json` et `mobile/app.json`.
3. Commiter (`chore(release): vx.y.z`), puis créer un tag annoté :

```bash
git tag -a vx.y.z -m "vx.y.z"
git push origin main --tags
```
