# Sécurité

Le sujet (V.6) demande deux choses : mettre en place des mécanismes de protection, et
**identifier les autres risques en expliquant les protections envisageables**. Ce document fait
les deux. La deuxième partie compte autant que la première : il n'est pas attendu que l'API soit
inviolable, il est attendu qu'on sache où elle est faible.

---

## Ce qui est en place

### Les mots de passe ne sont jamais stockés en clair

Hachage bcrypt avec 10 tours (`users.service.ts`). Bcrypt est volontairement lent : même avec un
dump complet de la base, retrouver les mots de passe coûte du temps de calcul. Un SHA-256 aurait
été instantané à casser sur un dictionnaire.

À la création, on impose 12 caractères minimum avec majuscule, minuscule, chiffre et caractère
spécial (`register.dto.ts`). Le mobile affiche la règle **pendant la saisie** plutôt qu'en erreur
après l'envoi : une contrainte qu'on découvre après coup pousse les gens vers le mot de passe le
plus court qui passe.

### Un utilisateur ne voit que ses données

C'est la première phrase de V.6, et c'est vérifié **côté serveur à chaque accès**, jamais en
masquant un bouton côté mobile. Deux fonctions portent tout :

- `assertCanView` — playlist publique, propriétaire, ou invité.
- `assertCanEdit` — appelle d'abord `assertCanView` (on n'édite pas ce qu'on n'a pas le droit de
  voir), puis vérifie la licence.

Même schéma dans `EventService` pour Track Vote. Le gateway websocket appelle **les mêmes
fonctions** que le contrôleur REST : ouvrir un socket ne contourne rien.

### Les tokens volés peuvent être révoqués

Un JWT est valide jusqu'à son expiration, on ne peut pas le « supprimer ». Au logout, on écrit
`blacklist:<token>` dans Redis avec un TTL égal au temps restant du token : la clé disparaît
d'elle-même au moment où le token aurait expiré, donc la liste ne grossit jamais indéfiniment.

Cette liste est consultée **en HTTP et à la poignée de main websocket**. C'est un point qu'on
avait failli oublier : sans ça, un token révoqué en HTTP pouvait encore ouvrir un socket et
continuer à recevoir les états en temps réel.

### Le bruteforce tape un mur

- Plafond global : 300 requêtes/minute/IP sur toutes les routes HTTP.
- Routes qui vérifient un secret (`login`, `register`, `forgot-password`, `reset-password`,
  `verify-email`) : **5 tentatives par minute et par IP**, avec un en-tête `Retry-After`.

Le comptage lit `x-forwarded-for` quand il est présent : derrière un reverse proxy, toutes les
requêtes portent l'IP du proxy, et sans ça un seul attaquant consommerait le quota de tout le
monde.

La limite des routes d'authentification n'est **pas** configurable par variable d'environnement,
volontairement. Une protection anti-bruteforce qu'on peut désactiver depuis l'environnement n'en
est plus vraiment une. Il existe bien un `THROTTLE_ALLOWLIST`, mais il est vide par défaut et sert
uniquement au test de charge (voir `ramp-up.md`) — s'il est rempli en production, la protection
saute pour les IP listées.

### Aucune fuite d'information par les messages d'erreur

Trois endroits où la réponse est délibérément vague :

- `/auth/login` répond « Invalid email or password » sans dire lequel des deux est faux.
- `/auth/forgot-password` répond toujours « If this email exists, a reset link has been sent »,
  que le compte existe ou non. Sinon la route devient un outil pour savoir qui est inscrit.
- Un event privé auquel on n'est pas invité renvoie **404 et pas 403**. Un 403 dirait « il existe
  mais tu n'y as pas droit », ce qui est déjà une information.

### Les données sensibles ne sortent pas des requêtes

Les requêtes qui chargent une relation `owner` restreignent explicitement les colonnes
(`select: { owner: { id: true, username: true } }`). Sans ce `select`, TypeORM renvoie l'entité
`User` complète — avec le hash du mot de passe, le token de vérification d'email et le token de
réinitialisation. C'est le genre de fuite qui passe inaperçue parce que le mobile n'affiche pas
ces champs, mais ils sont dans la réponse JSON.

### Les tokens à usage unique sont aléatoires et expirent

Vérification d'email et réinitialisation de mot de passe utilisent `crypto.randomBytes(32)`, avec
une date d'expiration vérifiée à l'usage, et le token est effacé après consommation. Pas de
`Math.random()`, qui est prédictible.

### Les entrées sont validées et filtrées

`ValidationPipe` global avec `whitelist: true` : tout champ non déclaré dans le DTO est
**supprimé** de la requête avant d'atteindre le service. Un client qui envoie
`{ name: "x", isAdmin: true }` voit son `isAdmin` disparaître.

Le typage fort de TypeORM et l'usage de query builders paramétrés écartent l'injection SQL : on ne
concatène jamais une valeur utilisateur dans une requête.

### Le token est stocké correctement côté mobile

`expo-secure-store` sur Android et iOS, c'est-à-dire le Keystore / Keychain du système. Sur le web
on retombe sur `localStorage`, faute de mieux — c'est une faiblesse assumée, détaillée plus bas.

### Tout est tracé

Chaque action, HTTP comme websocket, écrit une ligne dans la table `log` avec l'utilisateur, la
plateforme, l'appareil, la version de l'app, l'IP, le statut et la durée. Ça sert au sujet (V.6),
mais surtout : sans journal, on ne peut pas constater une attaque, encore moins l'analyser après
coup. Les tentatives refusées en 401 et 429 y figurent aussi, ce qui rend une campagne de
bruteforce visible.

### Les secrets ne sont pas dans le dépôt

`.env`, `.env.seed-users` et le pool du test de charge sont dans `.gitignore`. Les fichiers
`.env.exemple` / `.env.example` ne contiennent que des valeurs factices.

Nuance qu'il faut savoir expliquer : les `EXPO_PUBLIC_GOOGLE_CLIENT_ID_*` côté mobile **ne sont
pas des secrets** — un identifiant client OAuth voyage en clair dans l'URL d'autorisation, il est
public par construction. Le `GOOGLE_CLIENT_SECRET`, lui, ne quitte jamais le backend.

---

## Les risques identifiés et non couverts

Cette partie est demandée explicitement par le sujet. Aucun de ces points n'est corrigé
aujourd'hui : ils sont listés avec ce qu'on ferait, et pourquoi on ne l'a pas fait.

### 1. Le bruteforce distribué passe à travers

Le plafond est par IP. Un attaquant disposant de 200 adresses peut essayer 1000 mots de passe par
minute sur un compte donné sans jamais déclencher la limite.

**Ce qu'on ferait :** compter aussi par compte visé, pas seulement par IP — par exemple 10 échecs
consécutifs sur un email déclenchent un verrouillage temporaire de ce compte, indépendamment de
l'origine. Attention à l'effet de bord : ça permet à quelqu'un de verrouiller volontairement le
compte d'un tiers, donc en pratique on combine avec un délai croissant plutôt qu'un blocage sec.

### 2. Le compteur de limite ne survit pas au redémarrage, ni au passage à deux instances

Le stockage du throttler est **en mémoire**. Redémarrer le backend remet tous les compteurs à
zéro. Et si on lance deux instances derrière un load balancer, chacune a son propre compteur : la
limite réelle double.

**Ce qu'on ferait :** stockage Redis (`@nest-lab/throttler-storage-redis`). Redis est déjà dans la
stack, c'est un changement de quelques lignes. Ce n'est pas fait parce qu'on tourne sur un seul
processus, mais c'est **le premier correctif à appliquer** avant toute mise en ligne.

### 3. Pas de HTTPS

Tout est en HTTP en développement. Sur un réseau non maîtrisé, le JWT circule en clair et peut
être intercepté — ce qui rend la révocation du §« tokens volés » assez théorique, puisqu'il faut
d'abord savoir qu'on s'est fait voler.

**Ce qu'on ferait :** TLS obligatoire, terminé par un reverse proxy (nginx, Caddy), avec
redirection HTTP → HTTPS et HSTS.

### 4. CORS ouvert à tout le monde

`app.enableCors()` sans argument autorise **toutes** les origines. Pour une API consommée par une
app mobile ça a peu d'impact direct (une app native n'est pas soumise à la politique d'origine),
mais notre build web l'est, et n'importe quel site pourrait faire des requêtes à l'API depuis le
navigateur d'un utilisateur.

**Ce qu'on ferait :** une liste blanche d'origines lue dans la configuration. Cinq lignes, non
faites par simple confort de développement.

### 5. Le JWT vit 7 jours et ne peut pas être rafraîchi

Une durée de vie longue, c'est une fenêtre de vol longue. On n'a pas de refresh token : on ne peut
donc pas raccourcir le token d'accès sans obliger l'utilisateur à se reconnecter tous les jours.

**Ce qu'on ferait :** un token d'accès court (15 min) plus un refresh token révocable et à usage
unique. C'est le schéma standard ; on ne l'a pas mis parce qu'il double la surface d'authentification
à écrire et à tester, pour un projet où la révocation au logout suffit.

### 6. Sur le web, le token est dans `localStorage`

Donc lisible par n'importe quel JavaScript s'exécutant sur la page. Une seule faille XSS, ou une
dépendance npm compromise, et le token part. Sur mobile ce risque n'existe pas (Keystore /
Keychain).

**Ce qu'on ferait :** un cookie `httpOnly` + `Secure` + `SameSite=Strict`, inaccessible au
JavaScript — au prix d'une protection CSRF à ajouter, puisque les cookies partent automatiquement.

### 7. L'email de vérification n'est pas obligatoire pour utiliser l'app

Le champ `emailisVerified` existe et le mobile affiche un badge « Email not verified », mais aucune
route n'exige que l'email soit vérifié. On peut donc s'inscrire avec l'adresse de quelqu'un
d'autre et utiliser le service.

**Ce qu'on ferait :** un guard qui refuse les actions sensibles tant que l'email n'est pas
vérifié. Le sujet demande la validation par mail, ce qui est fait ; il ne demande pas de bloquer
l'accès, donc on s'est arrêtés là — mais c'est une faiblesse réelle.

### 8. Aucune limite de taille sur les entrées

`MaxLength` protège les champs texte des DTO, mais rien ne limite la taille globale d'un corps de
requête. Un `reorder` avec 500 000 identifiants ferait un travail inutile côté serveur.

**Ce qu'on ferait :** limiter la taille du corps au niveau d'Express (`json({ limit: '100kb' })`)
et borner les tableaux dans les DTO (`ArrayMaxSize`).

### 9. Le websocket n'est pas limité en débit

Le throttler ne s'applique qu'au HTTP. Un client authentifié peut émettre des milliers de
`playlist:reorder` par seconde et faire travailler la base en boucle.

**Ce qu'on ferait :** un compteur par socket dans le gateway. Le risque est modéré — il faut être
authentifié, donc identifiable dans les logs — mais il est réel.

### 10. `synchronize: true` sur TypeORM

TypeORM modifie le schéma automatiquement au démarrage pour coller aux entités. En production, une
entité mal renommée peut **supprimer une colonne et ses données** sans prévenir.

**Ce qu'on ferait :** des migrations explicites, versionnées et relues. C'est le point à changer en
premier le jour où la base contient des données réelles.

### 11. Les dépendances ne sont pas auditées

`npm audit` remonte des vulnérabilités connues sur l'arbre de dépendances, et personne ne les
regarde. Une dépendance transitive compromise a accès à tout le processus.

**Ce qu'on ferait :** `npm audit` dans la CI, en avertissement d'abord pour ne pas bloquer sur du
bruit, et une revue avant chaque livraison.

---

## Ce qu'on répond si on demande « et si on vous attaque ? »

Le sujet le dit lui-même : l'API n'est pas censée être inviolable. Notre position :

1. **Le serveur ne fait jamais confiance au client.** Toute permission est revérifiée côté
   backend, y compris sur le socket. Masquer un bouton n'est pas une protection.
2. **On préfère les garanties de la base aux `if` du code.** Un `if` se fait doubler par deux
   requêtes concurrentes ; une contrainte unique, non.
3. **On journalise tout.** On ne prétend pas empêcher toutes les attaques, mais on veut pouvoir
   constater qu'il s'en est passé une.
4. **On connaît nos trous.** La liste ci-dessus est ordonnée : les points 2 et 3 sont ceux qu'on
   corrigerait avant toute mise en ligne.
