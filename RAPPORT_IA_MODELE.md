# Rapport d'usage de l'IA — TP1, TP2 et TP3

Pour chaque mission, détailler et fournir des explications concernant : objectif; prompt principal; plan proposé par l'agent; vérifications réalisées par le binôme; erreurs ou propositions rejetées; fichiers effectivement modifiés; preuve de fonctionnement; ce que chaque membre sait maintenant expliquer sans l'agent.

Assistants utilisés :

| TP | Outil | Modèle |
|---|---|---|
| TP1 (Missions 0 et 1) | Claude Code (CLI) | Claude Sonnet 5 |
| TP2 et TP3 (Missions 2, 3, 5, 6, 7) | Claude Code (extension VS Code) | Claude Opus 5 |

Le passage de Sonnet 5 à Opus 5 pour les TP2 et TP3 est volontaire : ces séances
comportent des tâches d'analyse de code existant (Mission 3) et de mise en place
d'outillage de test (Mission 7) où le modèle doit tenir un raisonnement long sur
plusieurs fichiers à la fois. Sonnet 5 suffisait pour les modifications ciblées
du TP1.

**Comment vérifier la consommation de tokens** : dans Claude Code, la commande
`/cost` affiche la consommation et le coût de la session en cours ; la ligne de
contexte de l'interface indique aussi le pourcentage de fenêtre utilisé (ex.
« Current session: 17% used »). Pour un usage direct de l'API Anthropic, le
tableau de bord de la console développeur détaille l'usage par jour et par
modèle.

**Qui conseille le meilleur modèle pour une tâche donnée** : on peut le demander
directement à l'assistant, consulter la documentation officielle du fournisseur
(tableau comparatif des modèles), ou en discuter avec l'enseignant. Voir
`CONSEILS_POUR_UTIISER_ASSISTANT_AI.md` §10.

---

# TP1 — Authentification et profil

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

---

# TP2 — Bibliothèque, upload et lecture audio

## Mission 2 — Bibliothèque paginée

- **Objectif** : représenter la pagination serveur avec des Signals (`tracks`, `page`, `pages`, `loading`, erreur), afficher la liste avec `@for` / `@empty` / `@if`, et fournir des boutons « Précédent » / « Suivant » désactivés aux bornes — chaque changement de page devant produire une nouvelle requête HTTP, sans découpage local. Option AVANCÉ : utiliser le Paginator d'Angular Material.
- **Prompt principal** : « fais moi le sujet numéro 2, puis le sujet numéro 3, sors moi tout ce qu'il faut dans des comptes rendu pour chaque tp respectif, et met à jour le rapport ia modèle md ».
- **Plan proposé par l'agent** : lecture complète du dépôt avant toute écriture (les deux sujets, `API_CONTRACT.md`, les 6 composants, les services, guard et intercepteurs, `backend/src/app.js` en entier, `AGENTS.md` et `best-practices.md` des deux dossiers) ; constat que `TrackService.list()` transmettait déjà correctement `page` et `limit` et ne devait donc pas être réécrit ; audit de `TracksPageComponent` révélant trois manques : pas de Signal d'erreur, pas de Signal `limit` ni `total`, et un pager manuel. Proposition : installer `@angular/material` pour utiliser le Paginator (option AVANCÉ du sujet) et un commit par mission pour que l'historique Git montre la progression.
- **Vérifications réalisées par le binôme** : `npm run build` exécuté après la mission — succès. [À COMPLÉTER — vérifier dans l'onglet Network que chaque clic sur le paginator produit bien une requête avec un `page` différent, et que les flèches sont grisées en première et dernière page]
- **Erreurs ou propositions rejetées** : dans une première version, un attribut `[disabled]="uploading()"` avait été posé sur le champ `<input [formControl]="title">` : c'est incorrect avec les Reactive Forms (Angular émet un avertissement, car c'est le `FormControl` qui possède cet état), remplacé par `title.disable()` / `title.enable()`. Une double pagination (pager manuel **et** Paginator Material affichés ensemble) a été envisagée puis écartée : redondante à l'écran. Côté outillage, une première tentative d'écriture du composant par `heredoc` bash a échoué (fichier trop long), basculée sur l'outil d'édition de fichiers.
- **Fichiers effectivement modifiés** :
  - `frontend-starter/package.json` (ajout de `@angular/material` et `@angular/cdk` 22.1)
  - `frontend-starter/angular.json` (thème préfabriqué `azure-blue.css`)
  - `frontend-starter/src/styles.css` (jetons `--mat-sys-*` réalignés sur le vert de l'application)
  - `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.html`
- **Preuve de fonctionnement** : `npm run build` réussi ; test automatisé (écrit en Mission 7) vérifiant que `onPageChange({ pageIndex: 1, … })` produit bien une requête `/api/tracks?page=2&limit=5`. [À COMPLÉTER — capture Network]
- **Ce que chaque membre sait maintenant expliquer sans l'agent** : [À COMPLÉTER par chaque membre — ex : pourquoi le Paginator est indexé à 0 alors que l'API compte à partir de 1 ; pourquoi l'état local est réaligné sur `response.page` / `response.limit` (le serveur borne `limit` à 20) ; pourquoi récupérer toutes les pistes puis les découper dans Angular serait faux]

## Mission 3 — Analyse et complétion de l'upload et de la lecture

- **Objectif** : d'abord **analyser** le mécanisme existant (localiser chaque étape : choix du fichier, `FormData`, appel HTTP, `Blob`, `ObjectURL`, affectation au lecteur, révocation), expliquer pourquoi une URL placée dans `src` ne reçoit pas le JWT, identifier les contrôles déjà présents côté backend, puis **compléter seulement ce qui manque** côté frontend : validation avant l'appel, états d'envoi, cards responsives et accessibles, affichage du morceau en cours, erreur audio, révocation finale.
- **Prompt principal** : idem Mission 2 (un seul prompt couvrant les deux TP).
- **Plan proposé par l'agent** : ne rien réimplémenter de ce qui existe (le mécanisme `Blob` / `ObjectURL` était déjà en place) ; produire la table de correspondance étape → fichier:ligne demandée par le sujet ; extraire les contraintes du backend (`MAX_FILE_SIZE`, Set `allowed` du `fileFilter`) dans un nouveau fichier `shared/audio-constraints.ts` plutôt que de les coder en dur dans le composant, en documentant explicitement que cette duplication est un confort et non une sécurité ; compléter les états d'envoi et la lecture ; passer les cards en liste sémantique accessible.
- **Vérifications réalisées par le binôme** : `npm run build` réussi. Revue de code des contrôles backend confirmés ligne à ligne (`app.js:340-343` fichier requis, `app.js:109-119` `fileFilter`, `app.js:108` `limits.fileSize`). [À COMPLÉTER — tests manuels : envoyer un `.pdf` (doit être refusé côté frontend sans requête), envoyer un fichier de plus de 25 Mo, lancer deux lectures d'affilée et vérifier dans l'onglet Memory qu'aucun `Blob` ne s'accumule]
- **Erreurs ou propositions rejetées** : le sujet interdit de réimplémenter l'existant ; l'agent a donc dû être contenu à de la complétion — le mécanisme `play()` / `createObjectURL` n'a pas été réécrit, seulement complété (`currentTrack`, `audioError`, `loadingAudioId`, révocation à la destruction). Le template de départ affichait `{{ track.size }} Ko` alors que l'API renvoie des **octets** : erreur présente dans le code fourni, corrigée par une fonction `formatSize()`.
- **Fichiers effectivement modifiés** :
  - `frontend-starter/src/app/shared/audio-constraints.ts` (nouveau)
  - `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.html`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.css`
- **Preuve de fonctionnement** : `npm run build` réussi ; quatre tests automatisés couvrant cette mission (refus d'un fichier de 26 Mo sans aucune requête HTTP, refus d'un `.pdf`, `createObjectURL` appelée à la lecture, `revokeObjectURL` appelée à la destruction du composant). [À COMPLÉTER — captures]
- **Ce que chaque membre sait maintenant expliquer sans l'agent** : [À COMPLÉTER par chaque membre — ex : pourquoi `<audio src="/api/...">` reçoit un `401` (la requête est émise par le navigateur, pas par `HttpClient`, donc hors de la chaîne d'intercepteurs, et l'attribut `src` ne permet pas de déclarer un en-tête) ; pourquoi une validation frontend ne remplace jamais celle du backend ; la différence entre téléchargement complet d'un `Blob`, buffering navigateur et streaming serveur ; pourquoi révoquer une `ObjectURL`]

---

# TP3 — Fiabilisation et enrichissement

## Mission 5 — Suppression d'une piste

- **Objectif** : ajouter l'action « Supprimer » dans chaque card, avec confirmation, état de suppression contre les doubles clics, message de succès ou d'erreur via SnackBar, mise à jour de la page après suppression, et traitement du cas où la piste n'existe plus ou n'appartient pas à l'utilisateur. Expliquer pourquoi le guard Angular et l'interface ne suffisent pas à sécuriser la suppression.
- **Prompt principal** : idem Mission 2.
- **Plan proposé par l'agent** : ajouter `TrackService.remove(id)` comme unique point d'appel HTTP (le composant n'importe pas `HttpClient`) ; confirmation **inline en deux temps** dans la card plutôt que `window.confirm()` ; deux Signals distincts (`confirmingDeleteId` pour la card en attente, `deletingId` pour la requête en cours) ; `MatSnackBar` pour les deux issues ; une méthode `afterDelete()` centralisant la remise en cohérence de l'écran.
- **Vérifications réalisées par le binôme** : `npm run build` réussi ; trois tests automatisés (`DELETE` + rechargement, `404`, blocage du double clic). [À COMPLÉTER — test manuel du scénario à deux onglets : ouvrir la bibliothèque dans deux onglets, supprimer une piste dans le premier, cliquer « Supprimer » sur la même piste dans le second, vérifier le message et le rafraîchissement]
- **Erreurs ou propositions rejetées** : `window.confirm()` écarté (bloque le fil d'exécution, style non maîtrisable, et n'indique pas *quelle* piste est supprimée à un lecteur d'écran). Le retrait local de l'élément du tableau `tracks` a aussi été écarté au profit d'un vrai rechargement serveur : après une suppression, le nombre total de pages change et une piste de la page suivante doit remonter — un filtrage local afficherait 4 pistes sur 5 et un `total` faux.
- **Fichiers effectivement modifiés** :
  - `frontend-starter/src/app/shared/services/track.service.ts`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.html`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.css`
- **Preuve de fonctionnement** : build réussi ; tests verts ; côté backend, trois tests ajoutés en Mission 7 démontrent que la protection réelle est serveur (`401` sans JWT, avec un JWT invalide, et avec un JWT **signé par un autre secret**). [À COMPLÉTER — capture Network d'un `DELETE` suivi du `GET` de rechargement]
- **Ce que chaque membre sait maintenant expliquer sans l'agent** : [À COMPLÉTER par chaque membre — ex : les trois raisons de passer par un service ; comment contourner le guard en trois secondes depuis la console (`localStorage.setItem('gpc_token', 'nimportequoi')`) et pourquoi cela ne donne pourtant aucun accès aux données ; pourquoi le backend répond `404` et non `403` quand la piste appartient à quelqu'un d'autre]

## Mission 6 — Progression de l'upload

- **Objectif** : faire évoluer l'upload existant pour afficher sa progression, en distinguant au minimum l'absence d'upload, l'upload en cours avec pourcentage, la réussite et l'échec ; désactiver les contrôles et empêcher une seconde soumission ; expliquer pourquoi un upload avec progression ne se traite pas comme une requête émettant seulement une réponse finale.
- **Prompt principal** : idem Mission 2.
- **Plan proposé par l'agent** : passer `TrackService.upload()` en `observe: 'events'` + `reportProgress: true` ; dans le composant, trier les événements sur `event.type` (`UploadProgress` puis `Response`) ; remplacer les booléens d'état par un unique Signal typé `UploadState = 'idle' | 'uploading' | 'success' | 'error'` (une combinaison incohérente devient impossible) et dériver `uploading` avec `computed()` ; `mat-progress-bar` en mode `determinate` ou `indeterminate` selon que `event.total` est connu.
- **Vérifications réalisées par le binôme** : `npm run build` réussi ; trois tests automatisés (progression à 50 %, état de succès avec formulaire vidé, état d'erreur avec message serveur), plus un test de blocage de la double soumission. [À COMPLÉTER — test manuel : brider la connexion sur « Slow 3G » dans l'onglet Network et envoyer un fichier de plusieurs Mo pour voir la barre progresser réellement]
- **Erreurs ou propositions rejetées** : première version conservant plusieurs booléens (`uploading`, `uploadSuccess`, `uploadError`) comme source de vérité — remplacée par le Signal `uploadState` unique, les deux chaînes ne servant plus qu'à porter le texte du message. Le calcul du pourcentage sans garde sur `event.total` (`undefined` possible) aurait affiché « NaN % » : corrigé par un repli sur `null` et une barre indéterminée.
- **Fichiers effectivement modifiés** :
  - `frontend-starter/src/app/shared/services/track.service.ts`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.ts`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.html`
  - `frontend-starter/src/app/components/tracks-page/tracks-page.css`
- **Preuve de fonctionnement** : test injectant un événement `{ loaded: 512, total: 1024 }` et vérifiant `uploadProgress() === 50`, puis `Response` → `uploadState() === 'success'`, formulaire vidé, retour en page 1 et rechargement de la liste. [À COMPLÉTER — capture]
- **Ce que chaque membre sait maintenant expliquer sans l'agent** : [À COMPLÉTER par chaque membre — ex : la liste ordonnée des événements HTTP (`Sent`, `UploadProgress`…, `ResponseHeader`, `Response`) ; qu'Angular ne calcule pas le pourcentage mais fournit `loaded` et `total` ; pourquoi il reste un temps d'attente après 100 % (le serveur écrit encore le fichier et crée le document MongoDB)]

## Mission 7 — Tests automatisés

- **Objectif** : écrire au moins trois tests frontend parmi les sept proposés, vérifiant URL, méthodes, paramètres, headers et résultats simulés, sans dépendre d'un backend ni de MongoDB. Extension facultative : ajouter des tests de contrat ou de sécurité au backend.
- **Prompt principal** : idem Mission 2.
- **Plan proposé par l'agent** : valider d'abord l'outillage avec **un seul** test avant d'en écrire vingt-sept — décision qui s'est révélée déterminante, car trois obstacles d'environnement ont dû être levés l'un après l'autre (voir ci-dessous). Puis couvrir les sept propositions du sujet plutôt que le minimum de trois, et ajouter côté backend uniquement les cas qui ne nécessitent pas de base de données.
- **Vérifications réalisées par le binôme** : `npm test` frontend → **27 tests, 5 fichiers, 0 échec**. `npm test` backend → **11 tests, 0 échec**. `npm run build` → succès. Sortie brute reproduite dans `COMPTE_RENDU_TP3.md`. [À COMPLÉTER — relancer les deux suites sur la machine du binôme et coller la sortie]
- **Erreurs ou propositions rejetées** — les trois obstacles d'environnement et le bug de test :
  1. `ng test` refusait de démarrer : `Configuration 'development' for target 'build' … is not set`. Le builder `@angular/build:unit-test` cible par défaut `gpc:build:development`, configuration absente d'`angular.json`. Corrigé par `"buildTarget": "gpc:build"`.
  2. Aucun environnement DOM disponible : le runner Vitest exige `jsdom` ou `happy-dom`. `jsdom` ajouté en `devDependencies`.
  3. `localStorage` inaccessible : Node 26 expose un `localStorage` natif conditionné à l'option `--localstorage-file`, et ce global **masque celui de jsdom**. Comme `AuthService` lit `localStorage` dès l'initialisation de son champ `token`, le service n'était même pas instanciable. Corrigé par `src/test-setup.ts`, déclaré en `setupFiles`, qui installe une implémentation `Storage` en mémoire — sans aucun impact sur le code de l'application. Une première piste (`types: ["node"]` dans `tsconfig.spec.json`) a été rejetée : `@types/node` n'est pas installé, le build échouait sur `TS2688`.
  4. Un test écrit par l'agent échouait légitimement : il tentait de simuler une erreur `404` sur la requête audio en lui passant un corps JSON, alors que la requête attend un `Blob` (`Automatic conversion to Blob is not supported for response type`). Corrigé en fournissant un vrai `Blob` — ce qui correspond d'ailleurs à ce que le navigateur reçoit réellement.

  À noter également : les tests **échouent dans un environnement à bac à sable** restreignant les IPC entre processus (`[vitest-pool]: Failed to start forks worker`). Ils doivent être lancés dans un terminal normal. Ce n'est pas un défaut du code testé.
- **Fichiers effectivement modifiés** :
  - `frontend-starter/src/app/shared/services/auth.service.spec.ts` (nouveau, 3 tests)
  - `frontend-starter/src/app/shared/services/track.service.spec.ts` (nouveau, 6 tests)
  - `frontend-starter/src/app/shared/interceptors/auth.interceptor.spec.ts` (nouveau, 3 tests)
  - `frontend-starter/src/app/shared/guards/auth.guard.spec.ts` (nouveau, 2 tests)
  - `frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts` (nouveau, 13 tests)
  - `frontend-starter/src/test-setup.ts` (nouveau)
  - `frontend-starter/tsconfig.spec.json` (nouveau)
  - `frontend-starter/tsconfig.json`, `frontend-starter/angular.json`, `frontend-starter/package.json`
  - `backend/test/api.test.js` (9 tests ajoutés — les 2 tests existants conservés, aucune route modifiée)
- **Preuve de fonctionnement** :
  ```
  $ cd frontend-starter && npm test
   Test Files  5 passed (5)
        Tests  27 passed (27)

  $ cd backend && npm test
  ℹ tests 11
  ℹ pass 11
  ℹ fail 0
  ```
- **Ce que chaque membre sait maintenant expliquer sans l'agent** : [À COMPLÉTER par chaque membre — ex : pourquoi `provideHttpClientTesting()` rend MongoDB inutile ; pourquoi un test d'intercepteur doit monter `provideHttpClient(withInterceptors([...]))` et inspecter la requête *après* transformation ; ce que prouve le test « JWT signé par un autre secret » ; à quoi sert `httpTesting.verify()` dans `afterEach` ; la différence entre test unitaire et test d'intégration, et le classement de chacun des 5 fichiers de tests]

---

## Bilan sur l'usage de l'assistant (TP2 et TP3)

Ce qui a bien marché :

- **Lire avant d'écrire.** L'agent a parcouru l'intégralité du backend et du frontend avant la première modification. C'est ce qui a permis de constater que `TrackService.list()` était déjà correct et que le mécanisme `Blob` / `ObjectURL` existait — conformément à la consigne du sujet « ne réimplémentez pas ce qui existe déjà ».
- **Valider l'outillage sur un seul test.** Écrire les 27 tests d'un coup aurait produit 27 échecs identiques et illisibles à cause des trois problèmes d'environnement.
- **Un commit par mission.** L'historique Git montre la progression mission par mission, et le message de chaque commit dit ce qui a été fait et pourquoi.

Ce qui demande une vigilance du binôme :

- L'agent a produit du code **correct mais non vérifié en navigateur** : le build et les tests passent, mais le cluster MongoDB Atlas étant injoignable, aucune exécution réelle de bout en bout n'a pu être faite. Toutes les captures Network restent à produire.
- Deux erreurs typiques d'un modèle qui écrit vite ont dû être corrigées : l'attribut `[disabled]` sur un contrôle de formulaire réactif, et un corps de réponse d'erreur au mauvais type dans un test. Les deux ont été détectées par le build et par l'exécution des tests — d'où l'importance de **toujours lancer `npm run build` et `npm test`** plutôt que de faire confiance au code produit.
- Les numéros de ligne cités dans les comptes rendus ont dû être revérifiés un à un après coup : ils se décalent à chaque édition du fichier.
