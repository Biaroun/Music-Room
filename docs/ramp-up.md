# Ramp-up — capacité et montée en charge (sujet V.7)

Le sujet demande trois choses : les caractéristiques du serveur, une campagne de charge
reproductible, et un chiffre de capacité utilisateurs. Les trois sont ici.

**Résultat : 600 utilisateurs simultanés**, à ~1520 requêtes/seconde, sans aucune erreur.
Détail et méthode plus bas.

## 1. Caractéristiques de la machine

Campagne de référence lancée sur la machine de développement, backend et générateur de
charge sur le même hôte.

| | |
|---|---|
| CPU | Intel Core i9-13900H — 14 cœurs / 20 threads |
| RAM | 32 Go |
| OS | Ubuntu 22.04.5 LTS, noyau 6.8 |
| Node | v24 |
| Postgres | 15, conteneur Docker, port hôte 5433 |
| Redis | 7, conteneur Docker, port 6379 |
| Backend | NestJS, **un seul processus** (`npm run start:dev`), pas de cluster |

Deux limites structurelles à garder en tête en lisant les chiffres :

- **Un seul processus Node.** Un cœur travaille, dix-neuf regardent. Le premier levier de
  capacité serait `cluster` / PM2, pas une optimisation de requête.
- **Générateur de charge sur la même machine.** À forte charge, le générateur et le backend
  se disputent le CPU : les chiffres ci-dessous sont donc un **plancher**. Pour une mesure
  propre, lancer le runner depuis une autre machine avec `--api http://<hôte>:3001`.

## 2. Résultats mesurés

Campagne du 9 septembre 2026, paliers de 25 secondes, pool de 20 comptes réels.

| Utilisateurs simultanés | req/s | p50 (ms) | p95 (ms) | p99 (ms) | erreurs | verdict |
|---|---|---|---|---|---|---|
| 10 | 37 | 6 | 14 | 38 | 0 % | tenu |
| 25 | 95 | 4 | 12 | 48 | 0 % | tenu |
| 50 | 187 | 4 | 25 | 88 | 0 % | tenu |
| 100 | 372 | 4 | 31 | 92 | 0 % | tenu |
| 200 | 738 | 4 | 63 | 139 | 0 % | tenu |
| 400 | 1395 | 13 | 58 | 279 | 0 % | tenu |
| 500 | 1473 | 53 | 184 | 576 | 0 % | tenu |
| **600** | **1523** | **98** | **329** | **488** | **0 %** | **tenu** |
| 700 | 1438 | 181 | 407 | 813 | 0 % | dépassé (p95) |
| 800 | 1253 | 342 | 773 | 916 | 0 % | dépassé |
| 1200 | 1255 | 653 | 1227 | 1404 | 0 % | dépassé |
| 2000 | 1599 | 869 | 1420 | 1674 | 0 % | dépassé |

### Comment lire ces chiffres

**La capacité retenue est 600 utilisateurs simultanés**, c'est le dernier palier où les trois
seuils du §4 tiennent en même temps.

Le point intéressant : **le système ne casse pas, il ralentit**. Le taux d'erreur reste à 0 %
jusqu'à 2000 utilisateurs — aucune requête n'est refusée, aucune connexion n'est perdue. En
revanche le débit plafonne autour de **1500 req/s** dès 500 utilisateurs et n'augmente plus
ensuite : au-delà, les requêtes supplémentaires ne sont pas rejetées, elles **font la queue**,
et c'est la latence qui absorbe la charge (p95 de 63 ms à 200 utilisateurs, 1420 ms à 2000).

C'est exactement le comportement attendu d'un processus Node unique : la boucle d'événements
sature, le débit se stabilise à son maximum et la file d'attente s'allonge devant. Le chiffre
qui caractérise vraiment cette machine n'est donc pas « 600 utilisateurs » mais
**« ~1500 requêtes par seconde »** ; 600 en est la traduction pour notre profil d'usage
(4 requêtes par itération, 1 à 1,5 s de pause entre deux itérations).

Conséquence pratique : si les utilisateurs sont plus actifs que le profil simulé, la capacité
baisse proportionnellement. S'ils le sont moins — l'app en arrière-plan, ce qui est le cas le
plus fréquent — elle monte.

Un utilisateur simulé n'est pas un utilisateur inscrit : c'est **un utilisateur qui navigue en
continu**. Une population réelle est plusieurs fois supérieure à ce chiffre. Mais c'est celui
mesuré, donc c'est celui qu'on annonce.

## 3. Reproduire la campagne

### Préparer le pool

Le runner ne se connecte pas pendant la campagne : il réutilise des JWT créés à l'avance.
Sinon la mesure porterait surtout sur bcrypt et sur le limiteur anti-bruteforce.

```sh
make dev-back                                    # dans un autre terminal
# dans backend/.env, le temps de la campagne uniquement :
#   THROTTLE_ALLOWLIST=127.0.0.1
make load-seed                                   # 20 comptes + 1 playlist chacun
```

Sans `THROTTLE_ALLOWLIST`, le seeder fonctionne quand même mais attend une minute tous les
5 comptes, à cause du plafond anti-bruteforce sur `/auth/register`.

Le pool part dans `scripts/load/load-users.json` (ignoré par git : il contient des mots de
passe et des JWT valides 7 jours).

### Lancer

```sh
make load-test                                       # paliers 10,25,50,100,200
make load-test LOAD_STEPS=400,500,600,700            # autour du point de rupture
node scripts/load/run-load-test.js --steps 100,200 --duration 30 --api http://autre-hote:3001
```

**Important :** garder `THROTTLE_ALLOWLIST=127.0.0.1` pendant la campagne, sinon le plafond
global (300 req/min/IP) coupe la charge bien avant le point de rupture réel et on mesure le
limiteur au lieu de l'application. **Et le retirer après** — sinon les tests e2e qui vérifient
le 429 échouent, et surtout la protection est désactivée.

### Le profil simulé

Chaque itération d'un utilisateur enchaîne les quatre appels d'un écran d'accueil :

```
GET /users/me
GET /playlist-editor
GET /playlist-editor/:id
GET /friendship/friends
```

puis attend 0,5 à 1,5 seconde. C'est le profil majoritaire : quelqu'un qui ouvre l'app et
navigue. Volontairement **en lecture seule**, pour deux raisons : c'est ce que font les
utilisateurs la plupart du temps, et la campagne ne laisse rien en base, donc elle est
rejouable à l'identique autant de fois qu'on veut.

Le générateur envoie les mêmes en-têtes `x-client-*` que l'app mobile : la charge passe donc
par le même chemin d'écriture de logs V.6 que du trafic réel, écriture en base comprise.

## 4. Seuils

| Métrique | Seuil | Pourquoi |
|---|---|---|
| taux d'erreur | < 1 % | au-delà, des utilisateurs voient réellement des échecs |
| `p95` | < 400 ms | seuil courant de fluidité perçue sur mobile |
| `p99` | < 1000 ms | au-delà d'une seconde, l'utilisateur a le sentiment d'attendre |

Le runner sort en code ≠ 0 si aucun palier ne tient : utilisable en CI.

## 5. Pourquoi ce runner et pas k6

Le sujet cite « AB, Gatling, Siege, Tsung, JMeter **for instance** » : le choix de l'outil est
libre du moment que la mesure est justifiée.

k6 est un binaire Go qui s'installe avec les droits root, ce dont on ne dispose pas toujours
sur une machine d'école. `scripts/load/run-load-test.js` est écrit en Node **sans aucune
dépendance** : il tourne avec le Node déjà nécessaire au projet, donc n'importe qui peut
rejouer la campagne après un simple `git clone`. C'est ce qui rend le chiffre vérifiable par
un correcteur plutôt que déclaratif.

`scripts/load/k6-ramp-up.js` reste dans le dépôt pour qui a k6 installé : il fait une montée
progressive plutôt que par paliers, et ajoute un scénario d'écriture.

## 6. Limites connues et leviers

| Limite | Levier |
|---|---|
| Un seul processus Node (le facteur dominant) | `cluster` / PM2 en mode fork : sur 20 threads, on devrait approcher un ordre de grandeur de plus |
| Stockage du throttler en mémoire | stockage Redis — indispensable dès qu'il y a plus d'une instance, sinon chaque instance a son propre compteur |
| Générateur sur la même machine | lancer le runner depuis un autre poste pour une mesure non biaisée |
| Campagne en lecture seule | ajouter un scénario d'écriture pour mesurer la contention Postgres et les diffusions websocket |
| Websockets non mesurés | le runner est HTTP ; le coût réel d'une room de playlist très active reste à mesurer |
| Un `INSERT` de log par requête | déjà « fire and forget », mais à mettre en tampon sous forte charge |
| `synchronize: true` sur TypeORM | migrations explicites avant toute mise en production |

## 7. Vérifier la protection anti-bruteforce (V.6)

Exclusif de la campagne : celle-ci tourne avec le limiteur neutralisé, et un limiteur
neutralisé ne peut évidemment pas répondre 429.

```sh
# retirer THROTTLE_ALLOWLIST de backend/.env, redémarrer le backend, puis :
cd backend && npx jest --config ./test/jest-e2e.json
```

Le test `coupe le bruteforce sur /auth/login` envoie 8 tentatives erronées d'affilée et vérifie
que les 5 premières reçoivent 401 et les suivantes 429.
