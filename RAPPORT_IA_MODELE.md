# Rapport d'usage de l'IA - TP1

Pour chaque mission, détailler et fournir des explications concernant : objectif; prompt principal; plan proposé par l'agent; vérifications réalisées par le binôme; erreurs ou propositions rejetées; fichiers effectivement modifiés; preuve de fonctionnement; ce que chaque membre sait maintenant expliquer sans l'agent.

Assistant utilisé : Claude Code (CLI), modèle Claude Sonnet 5. [BINÔME : complétez ici comment vérifier la consommation de tokens dans votre outil, et qui vous a conseillé ce modèle — voir `CONSEILS_POUR_UTIISER_ASSISTANT_AI.md` §10.]

## Mission 0 — Cartographier l'application

- **Objectif** : comprendre le trajet composant → service → `HttpClient` → API pour la connexion, produire un schéma annoté du clic sur « Se connecter », et distinguer les routes publiques des routes protégées dans `API_CONTRACT.md`.
- **Prompt principal** : « Produire un schéma annoté du flux lors d'un clic sur « Se connecter ». Ouvrir API_CONTRACT.md et distinguer les routes publiques des routes protégées. »
- **Plan proposé par l'agent** : lecture de `login-page.ts/.html`, `auth.service.ts`, `auth.interceptor.ts`, `auth.guard.ts`, `routes.ts`, `app.js` (backend) ; construction d'un diagramme de séquence (5 acteurs : Navigateur, LoginPageComponent, AuthService, route `POST /auth/login`, modèle `User`) avec branche succès/échec, plus un tableau des 9 routes du contrat classées publiques/protégées.
- **Vérifications réalisées par le binôme** : [À COMPLÉTER — relire le schéma en le comparant ligne à ligne avec `login-page.ts`, `auth.service.ts`, `app.js`]
- **Erreurs ou propositions rejetées** : aucune à cette étape.
- **Fichiers effectivement modifiés** : `docs/parcours-connexion.html` (nouveau, lecture seule sur le reste du code — Mission 0 ne modifie rien).
- **Preuve de fonctionnement** : page HTML publiée (artefact) + fichier local `docs/parcours-connexion.html` ouvrable directement dans un navigateur. [À COMPLÉTER — capture d'écran du schéma à ajouter ici]
- **Ce que chaque membre sait maintenant expliquer sans l'agent** : [À COMPLÉTER par chaque membre — ex : le trajet exact d'une requête de connexion, pourquoi `/auth/login` ne porte pas de token, où se trouve le middleware `auth` côté backend]

## Mission 1 — Inscription, connexion et profil

- **Objectif** : compléter les 10 exigences de la partie utilisateur (`SUJET_ETUDIANT_TP1.md:63-74`). Audit du code existant : 6 points déjà couverts, 4 manquants traités dans l'ordre — #2 (validation par champ), #7 (bouton de déconnexion), #8 (auto-chargement du profil), #10 (redirection sur 401).
- **Prompt principal** : « on m'a demandé de compléter ou réécrire la partie utilisateur du frontend, en me citant les points 1 par 1 » puis « fais dans l'ordre, et pour l'instant met toi en mode planification ».
- **Plan proposé par l'agent** : entrée en mode planification, exploration ciblée (enregistrement des intercepteurs dans `main.ts`, styles de formulaire globaux dans `styles.css`, pattern de chargement dans le constructeur de `TracksPageComponent`, absence de logique de déconnexion dans `app.ts`), plan écrit et validé avant toute modification, puis implémentation des 4 points dans l'ordre.
- **Vérifications réalisées par le binôme** : `npm run build` exécuté après implémentation — succès, aucune erreur TypeScript (bundle généré en ~5,2 s). [À COMPLÉTER — tests manuels dans le navigateur : inscription avec mot de passe court, connexion/déconnexion, token invalidé manuellement dans `localStorage` puis rechargement d'une page protégée]
- **Erreurs ou propositions rejetées** : première proposition de style pour le bouton « Déconnexion » (transformé en lien texte, sans fond) rejetée par le binôme — le style attendu était l'inverse : uniformiser « Backing tracks » et « Profil » en boutons pleins comme « Déconnexion », pas l'inverse. Corrigé dans `styles.css` (règle `header nav a, header nav button`).
- **Fichiers effectivement modifiés** :
  - `frontend-starter/src/styles.css`
  - `frontend-starter/src/app/components/register-page/register-page.ts`
  - `frontend-starter/src/app/components/register-page/register-page.html`
  - `frontend-starter/src/app/components/login-page/login-page.html`
  - `frontend-starter/src/app/components/app/app.ts`
  - `frontend-starter/src/app/components/app/app.html`
  - `frontend-starter/src/app/components/profile-page/profile-page.ts`
  - `frontend-starter/src/app/components/profile-page/profile-page.html`
  - `frontend-starter/src/app/shared/interceptors/auth-error.interceptor.ts` (nouveau)
  - `frontend-starter/src/main.ts`
- **Preuve de fonctionnement** : build réussi (voir ci-dessus). [À COMPLÉTER — capture Network d'une connexion réussie, d'une connexion refusée, et d'un appel à `/api/users/me`, comme demandé dans le Checkpoint du sujet]
- **Ce que chaque membre sait maintenant expliquer sans l'agent** : [À COMPLÉTER par chaque membre — ex : pourquoi le guard seul ne suffit pas à détecter un token expiré, pourquoi `authErrorInterceptor` exclut `/auth/login` et `/auth/register`, différence entre Signal et `localStorage` dans `AuthService`]
