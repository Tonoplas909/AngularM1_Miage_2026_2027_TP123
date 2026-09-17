# Compte-rendu TP1 — Architecture Authentification et Profil

Ce fichier reprend les questions posées dans `SUJET_ETUDIANT_TP1.md` et les
livrables attendus. Les captures d'écran mentionnées doivent être ajoutées
au projet (ex. dans un dossier `captures/`) puis liées ici avec
`![légende](captures/nom-du-fichier.png)`.

## Mission 0 — Cartographie de l'application

**Schéma annoté du flux de connexion** : voir `docs/parcours-connexion.html`
(ou l'artefact partagé : https://claude.ai/artifact/BsJizhHMWp43rXrcxq6yF3)

**Routes publiques vs protégées** (`API_CONTRACT.md`) :

| Route | Accès |
|---|---|
| `GET /health` | Publique |
| `POST /auth/register` | Publique |
| `POST /auth/login` | Publique |
| `GET /users/me` | Protégée (JWT) |
| `PUT /users/me` | Protégée (JWT) |
| `GET /tracks` | Protégée (JWT) |
| `POST /tracks` | Protégée (JWT) |
| `GET /tracks/:id/audio` | Protégée (JWT) |
| `DELETE /tracks/:id` | Protégée (JWT) |

Règle : toute route protégée passe par le middleware `auth` de
`backend/src/app.js`, qui exige `Authorization: Bearer <token>` et rejette en
`401` sinon.

## Mission 1 — Inscription, connexion et profil

### Quelles routes du backend sont utilisées ?

Dans le périmètre de cette mission (inscription/connexion/profil) :
`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/users/me`,
`PUT /api/users/me`. Les routes `/api/tracks*` existent dans le contrat mais
appartiennent au TP2 (bibliothèque audio), pas à la partie utilisateur.

### Où s'effectue la tâche « mise à jour du profil utilisateur » ?

- **Backend** : `backend/src/app.js`, handler `app.put("/api/users/me", auth, ...)`
  — passe par le middleware `auth` (vérifie le JWT), puis
  `User.findByIdAndUpdate(req.auth.sub, { $set: { name: req.body?.name } }, ...)`.
- **Frontend** :
  - `frontend-starter/src/app/shared/services/auth.service.ts`,
    méthode `update(name)` — seul point qui appelle `HttpClient.put('/api/users/me', ...)`.
  - `frontend-starter/src/app/components/profile-page/profile-page.ts`,
    méthode `save()` — appelle `auth.update(...)` avec la valeur du formulaire.
  - `frontend-starter/src/app/components/profile-page/profile-page.html`
    — formulaire réactif (`formControlName="name"`) qui déclenche `save()` au submit.

### Questions sur l'assistant IA

- **Modèle utilisé** : Claude Sonnet 5, via Claude Code (CLI).
- **Consommation de tokens** : Claude Code affiche le coût/la consommation de
  la session avec la commande `/cost` ; les outils basés sur l'API Anthropic
  affichent aussi l'usage dans le tableau de bord de la console développeur.
  "Current session: 17% used · resets Sep 17, 9:50pm (Europe/Paris)"
- **Qui conseille le meilleur modèle pour une tâche donnée** : on peut le
  demander directement à l'assistant (voir
  `CONSEILS_POUR_UTIISER_ASSISTANT_AI.md` §10), consulter la documentation
  officielle du fournisseur, ou en discuter avec l'enseignant.

## Checkpoint — preuves Network

Extrait de `localhost.har` (capturé le 2026-09-17 vers 15:27, page `/login`).
Mots de passe et JWT masqués volontairement — voir la note de sécurité en
bas de section.

### 1. Connexion réussie

- Méthode / URL : `POST http://localhost:4200/api/auth/login`
- Corps envoyé : `{"email":"demo@example.com","password":"[masqué]"}`
- Statut : `200 OK`
- Réponse : `{"token":"eyJhbGci...[masqué]","user":{"id":"6aabf72ba50c49710d68f2e0","name":"Demo","email":"demo@example.com","createdAt":"2026-09-17T14:20:28.014Z"}}`
- Authorization dans la requête : absent — normal, `/auth/login` est une route publique (voir `API_CONTRACT.md`), le token n'existe pas encore à ce moment.
- Capture : [À COMPLÉTER — capture d'écran de cette entrée dans l'onglet Network]

### 2. Connexion refusée

- Méthode / URL : `POST http://localhost:4200/api/auth/login`
- Corps envoyé : `{"email":"demo@example.com","password":"[masqué — mot de passe volontairement erroné]"}`
- Statut : `401 Unauthorized`
- Réponse : `{"message":"Identifiants incorrects"}`
- Authorization dans la requête : absent (même raison qu'au-dessus).
- Capture : [À COMPLÉTER]

### 3. Lecture de `/api/users/me`

- Méthode / URL : `GET http://localhost:4200/api/users/me`
- Statut : `304 Not Modified` (revalidation via `If-None-Match`/ETag — le corps mis en cache par le navigateur est réutilisé)
- Réponse (contenu mis en cache, renvoyé par le navigateur) : `{"id":"6aabf72ba50c49710d68f2e0","name":"Demo","email":"demo@example.com","createdAt":"2026-09-17T14:20:28.014Z"}`
- Authorization dans la requête : **non visible dans le `.har` exporté**, mais forcément présente et valide au moment de l'envoi réel — sinon le middleware `auth` de `backend/src/app.js` aurait renvoyé `401` avant même que le serveur calcule l'ETag et réponde `304`. Chrome redacte probablement l'en-tête `Authorization` à l'export HAR par sécurité. [À COMPLÉTER si vous avez une capture DevTools brute confirmant l'en-tête visible avant export]
- Requête déclenchée par : `Referer: http://localhost:4200/profile` — confirme que le chargement automatique du profil à l'arrivée sur `/profile` (point #8, `profile-page.ts`) fonctionne bien.

**Sécurité** : `localhost.har` contient le mot de passe en clair et le JWT complet dans les corps de requête/réponse. Ne pas commit ce fichier ni le joindre tel quel au rendu — seuls les extraits masqués ci-dessus doivent apparaître dans la documentation.

## Signal vs `localStorage`

`localStorage` persiste le token entre deux rechargements de page, mais
Angular ne le lit pas automatiquement : ce n'est pas réactif. Le Signal
`token` / `currentUser` d'`AuthService` est l'état réactif en mémoire : toute
lecture dans un template (`auth.token()`, `auth.currentUser()`) se met à jour
seule dès qu'on appelle `.set(...)`. Dans le code, `AuthService` les
synchronise à la main : `localStorage` sert de persistance (survit à un F5),
le Signal sert de source de vérité pour l'UI pendant que l'application
tourne (connexion → écrit les deux ; déconnexion → efface les deux).

Voir aussi `RAPPORT_IA_MODELE.md` pour le détail des prompts, du plan
proposé par l'agent et des fichiers modifiés.
