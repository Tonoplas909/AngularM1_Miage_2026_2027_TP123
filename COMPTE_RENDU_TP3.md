# Compte-rendu TP3 — Fiabilisation et enrichissement du frontend

Ce fichier reprend les missions, les vérifications et les livrables de
`SUJET_ETUDIANT_TP3.md`.

**État de vérification** :

| Vérification | Résultat |
|---|---|
| `npm run build` (frontend) | ✅ succès, bundle 639 kB brut / 141 kB transféré |
| `npm test` (frontend) | ✅ **27 tests, 5 fichiers, 0 échec** |
| `npm test` (backend) | ✅ **11 tests, 0 échec** (2 existants + 9 ajoutés) |
| Captures Network | ⚠️ à produire — voir la note ci-dessous |

Le cluster MongoDB Atlas configuré dans `backend/.env` n'était pas joignable
depuis la machine au moment de la rédaction
(`querySrv ECONNREFUSED _mongodb._tcp.cluster0.xb7iesh.mongodb.net` — cluster
vraisemblablement en pause côté Atlas). Les captures Network et la démonstration
en navigateur restent donc à produire après redémarrage du cluster. C'est
précisément pour cette raison que la Mission 7 a de la valeur : **les 38 tests
ci-dessus tournent tous sans backend et sans MongoDB.**

---

## Lecture du code existant — manques identifiés (0:00–0:15)

| Point | État avant le TP3 |
|---|---|
| `DELETE /api/tracks/:id` | Route backend présente (`app.js:409`), **aucun appel côté frontend** |
| Confirmation de suppression | Absente |
| Progression de l'upload | Absente — `upload()` n'observait que la réponse finale |
| États d'upload | Partiels (traités en TP2 Mission 3 : chargement, succès, erreur — mais sans pourcentage) |
| Tests frontend | **Aucun** — pas un seul fichier `.spec.ts` |
| Tests backend | 2 seulement : `/api/health` et les schémas Mongoose |

---

## Mission 5 — Suppression d'une piste

### Composant et service concernés

- **Service** : `TrackService.remove(id)` —
  `frontend-starter/src/app/shared/services/track.service.ts:52`
- **Composant** : `TracksPageComponent` —
  `askDelete()` (`tracks-page.ts:264`), `cancelDelete()` (`tracks-page.ts:269`),
  `confirmDelete()` (`tracks-page.ts:277`), `afterDelete()` (`tracks-page.ts:326`)
- **Template** : bloc de la card, `tracks-page.html:110-142`

Le composant **n'appelle jamais `HttpClient`** : il n'en importe même pas le
symbole. Il ne connaît que `TrackService`. Seul le service possède
`HttpClient` :

```ts
// track.service.ts:52
remove(id: string) {
  return this.http.delete<void>(`/api/tracks/${id}`);
}
```

### Pourquoi la suppression passe par un service

Trois raisons concrètes, pas seulement stylistiques :

1. **Un seul endroit connaît le contrat HTTP.** Si l'URL, la méthode ou la forme
   de la réponse change, un seul fichier est à modifier. Aujourd'hui trois
   composants pourraient vouloir supprimer une piste ; ils partageraient la même
   méthode.
2. **Le composant devient testable sans HTTP.** On peut lui injecter un double
   du service, et symétriquement tester le service sans composant — c'est
   exactement ce que fait la Mission 7.
3. **Les intercepteurs restent en jeu.** Le JWT est ajouté par `authInterceptor`
   et le `401` traité par `authErrorInterceptor` parce que l'appel passe par
   `HttpClient` du service. Un `fetch()` écrit à la main dans un composant
   contournerait les deux et il faudrait tout reproduire.

### Confirmation avant suppression

Confirmation **en deux temps, dans la card elle-même** plutôt qu'un
`window.confirm()` :

```text
état normal         :  [ ▶ Lire ]  [ Supprimer ]
après « Supprimer » :  Supprimer définitivement ?  [ Annuler ]  [ Confirmer ]
```

Porté par le Signal `confirmingDeleteId` (`tracks-page.ts:79`), qui retient
l'identifiant de la card en attente. Raisons de ce choix plutôt que la boîte
native :

- `window.confirm()` bloque tout le fil d'exécution du navigateur et son style
  n'est pas maîtrisable ;
- l'affichage inline reste dans le flux du document, donc navigable au clavier,
  annoncé par un `role="group"` avec un `aria-label` nommant la piste
  concernée (« Confirmer la suppression de Blues en La ») — un `confirm()` ne
  dit pas *quoi* on supprime ;
- c'est testable sans espionner une fonction globale du navigateur.

### État de suppression et double clic

Signal `deletingId` (`tracks-page.ts:80`). Deux protections superposées :

```ts
// tracks-page.ts:277 — garde dans le code
confirmDelete(track: Track): void {
  if (this.deletingId()) return;
  this.deletingId.set(track.id);
  ...
```
```html
<!-- tracks-page.html:118 — garde dans l'interface -->
<button class="danger" (click)="confirmDelete(track)" [disabled]="deletingId() !== null">
  {{ deletingId() === track.id ? 'Suppression…' : 'Confirmer' }}
</button>
```

Le `[disabled]` empêche le clic ; la garde dans le code couvre les cas que le
template ne voit pas (double clic très rapide avant le rafraîchissement,
appel programmatique). Un test vérifie que deux appels consécutifs ne produisent
**qu'une seule** requête `DELETE`.

### Message de succès ou d'erreur — SnackBar

`MatSnackBar` d'Angular Material, injecté dans le composant
(`tracks-page.ts:41`) :

```ts
this.snackBar.open(`« ${track.title} » a été supprimé.`, 'Fermer', { duration: 4000 });
```

Cela a nécessité d'ajouter `@angular/material` et `@angular/cdk` (version 22.1,
alignée sur Angular 22.1.4) aux dépendances, et le thème préfabriqué
`azure-blue.css` dans `angular.json`. Les jetons de couleur Material
(`--mat-sys-primary`, etc.) ont été réalignés sur le vert de l'application dans
`styles.css` pour ne pas casser la charte.

### Mise à jour de la page après suppression

`afterDelete()` (`tracks-page.ts:326`) fait trois choses :

1. si la piste supprimée était **en cours de lecture**, son `Blob` est libéré et
   le lecteur est retiré — sinon on écouterait un morceau qui n'existe plus ;
2. si c'était **la dernière piste de la page** et qu'on n'est pas en page 1, on
   recule d'une page — sinon l'utilisateur se retrouverait sur une page vide ;
3. `load()` est appelé : une nouvelle requête `GET /api/tracks?page=…&limit=…`
   part vers le serveur.

Le choix de **redemander la page au serveur** plutôt que de retirer l'élément du
tableau local est délibéré : après suppression, le nombre total de pages a
changé, et une piste de la page suivante doit remonter pour combler le trou.
Un filtrage local afficherait 4 pistes sur une page de 5 et un `total` faux.

### Piste déjà supprimée ou n'appartenant pas à l'utilisateur

Le backend répond `404 { "message": "Piste inconnue" }` dans les deux cas, parce
que son filtre combine les deux conditions :

```js
// app.js:411
const track = await Track.findOneAndDelete({
  _id: req.params.id,
  ownerId: req.auth.sub,
}).select("+storedName");
```

C'est volontaire : distinguer « n'existe pas » de « n'est pas à vous »
apprendrait à un attaquant quels identifiants existent réellement.

Traitement frontend (`tracks-page.ts:298-313`) : message dédié
« Cette piste n'existe plus ou ne vous appartient pas. », puis **`afterDelete()`
est appelé quand même**. Le raisonnement : dans les deux cas l'écran affiche une
information périmée, donc il faut le resynchroniser. Scénario exact visé par le
sujet — deux onglets ouverts, suppression dans le premier, clic sur « Supprimer »
dans le second : l'utilisateur voit le message et la liste se remet à jour.

### Pourquoi le guard Angular et l'interface ne suffisent pas

`authGuard` (`auth.guard.ts:10`) se contente de regarder si un Signal contient
une chaîne de caractères :

```ts
return auth.token() ? true : router.createUrlTree(['/login']);
```

Il ne vérifie **ni** la signature du token, **ni** son expiration, **ni** à qui
appartient la piste. Il ne pourrait pas : le secret de signature est sur le
serveur et ne doit jamais descendre dans le navigateur.

Tout ce qui est côté client est modifiable par le client. Concrètement, pour
contourner le guard et l'interface, il suffit de :

- écrire `localStorage.setItem('gpc_token', 'nimportequoi')` dans la console —
  le guard laisse alors passer ;
- supprimer l'attribut `disabled` d'un bouton dans l'inspecteur ;
- ou ignorer complètement l'application : `curl -X DELETE http://localhost:3000/api/tracks/<id> -H "Authorization: Bearer <token>"`.

Le guard et le `[disabled]` sont donc de l'**ergonomie** : ils évitent d'afficher
une page qui échouerait et de lancer des requêtes vouées au `401`. La sécurité
réelle est ailleurs, et à deux niveaux côté serveur :

1. **Authentification** — `auth` (`app.js:56-78`) exige le préfixe `Bearer ` et
   appelle `jwt.verify(raw.slice(7), SECRET)`, qui vérifie la signature *et* la
   date d'expiration. Un token forgé sans le secret est rejeté en `401`.
2. **Autorisation** — `ownerId: req.auth.sub` dans le filtre
   `findOneAndDelete` (`app.js:411`). Le propriétaire n'est pas lu dans la
   requête du client mais **extrait du token vérifié**. Même avec un JWT valide,
   l'utilisateur A ne peut pas supprimer une piste de B.

Ces deux points sont couverts par les tests backend ajoutés : un `401` sans JWT,
un `401` avec un JWT invalide, et un `401` avec un JWT **signé par un autre
secret** — ce dernier démontre que c'est bien la signature qui protège la route.

---

## Mission 6 — Progression de l'upload

### Le changement dans le service

```ts
// track.service.ts:30
upload(file: File, title: string) {
  const body = new FormData();
  body.append('audio', file);
  body.append('title', title);
  return this.http.post<Track>('/api/tracks', body, {
    reportProgress: true,
    observe: 'events',
  });
}
```

Deux options, deux rôles distincts :

- `reportProgress: true` demande à Angular d'écouter les événements de
  progression de la couche de transport (`XMLHttpRequest.upload.onprogress`).
  Sans elle, aucun événement intermédiaire n'est produit.
- `observe: 'events'` change **le type de l'Observable** :
  `Observable<Track>` devient `Observable<HttpEvent<Track>>`.

### Pourquoi ce n'est pas une requête HTTP ordinaire

Une requête classique avec `HttpClient` produit un Observable qui **émet une
seule valeur puis se termine** : la réponse désérialisée. Le `next` est appelé
une fois, et cette valeur *est* le résultat.

Avec `observe: 'events'`, l'Observable émet **plusieurs valeurs successives**, de
natures différentes, dans l'ordre chronologique de la requête :

```text
HttpEventType.Sent            (0)  la requête part
HttpEventType.UploadProgress  (1)  loaded: 262144, total: 2097152     ← répété
HttpEventType.UploadProgress  (1)  loaded: 524288, total: 2097152
        …
HttpEventType.ResponseHeader  (2)  en-têtes reçus
HttpEventType.Response        (4)  body: Track                        ← le résultat
```

Trois conséquences pratiques :

1. **On ne peut plus traiter la valeur reçue comme la réponse.** Il faut trier
   sur `event.type`, sinon on tenterait de lire `track.id` sur un événement de
   progression. C'est le `if (event.type === HttpEventType.UploadProgress)` /
   `if (event.type === HttpEventType.Response)` de `tracks-page.ts:199-221`.
2. **Le succès n'est pas « l'Observable a émis » mais « l'Observable a émis un
   `Response` ».** Vider le formulaire dès la première émission le viderait
   pendant l'envoi.
3. **La progression concerne la montée, pas le traitement serveur.** À 100 %, le
   navigateur a fini d'envoyer les octets ; le serveur, lui, doit encore écrire
   le fichier sur disque et créer le document MongoDB. Il y a donc un temps
   d'attente après 100 % et avant l'événement `Response` — ce qui est normal et
   explique qu'on garde l'état `uploading` jusqu'au `Response`.

### Comment le pourcentage est calculé

```ts
// tracks-page.ts:202
this.uploadProgress.set(
  event.total ? Math.round((100 * event.loaded) / event.total) : null,
);
```

`event.loaded` = octets déjà transmis, `event.total` = taille totale annoncée.
Angular ne calcule aucun pourcentage : il transmet les deux nombres bruts, c'est
au code de faire la division. `event.total` est **optionnel** : si le navigateur
ne connaît pas la taille totale (requête non « length-computable »), il est
`undefined`. Diviser par `undefined` donnerait `NaN` et afficherait « NaN % » ;
d'où le `null` et le repli sur une barre indéterminée.

### Les quatre états

Un seul Signal les porte (`tracks-page.ts:31` et `:65-74`), ce qui rend
mécaniquement impossible une combinaison incohérente du type « en cours » +
« réussi » :

```ts
export type UploadState = 'idle' | 'uploading' | 'success' | 'error';
readonly uploadState = signal<UploadState>('idle');
readonly uploading = computed(() => this.uploadState() === 'uploading');
```

| État | Déclencheur | Affichage |
|---|---|---|
| `idle` | état initial, ou sélection d'un nouveau fichier | rien |
| `uploading` | `upload()` appelé | « Envoi en cours… N % » + `mat-progress-bar` |
| `success` | événement `Response` reçu | message vert nommant la piste ajoutée |
| `error` | callback `error` de la souscription | message du serveur, `role="alert"` |

Rendu par un `@switch` (`tracks-page.html:49-73`), donc un seul bloc visible à
la fois. `uploading` est un `computed()` : l'état dérivé n'est pas dupliqué.

### Contrôles désactivés et double soumission

- bouton : `[disabled]="!selectedFile() || uploading()"` (`tracks-page.html:42`) ;
- champ fichier : `[disabled]="uploading()"` ;
- champ titre : `title.disable()` / `title.enable()` — par l'API du
  `FormControl`, car avec les Reactive Forms c'est le contrôle qui possède cet
  état, pas le template ;
- garde dans le code : `if (!file || this.uploading()) return;`
  (`tracks-page.ts:175`).

Vérifié par le test « bloque une seconde soumission pendant un upload en cours » :
deux `upload()` consécutifs, une seule requête `POST`.

### Aucune donnée sensible journalisée

Revue de tous les `console.*` du frontend : ils ne journalisent que des
identifiants, des noms de fichiers et des compteurs. Aucun mot de passe, aucun
token. Les endroits à surveiller :

- `login-page.ts:31` : `console.debug('[LoginPage] Connexion réussie')` — pas de
  corps de requête ;
- `auth.service.ts` : aucun `console.log` du token ;
- `auth-error.interceptor.ts:19` : journalise l'URL, pas l'en-tête ;
- `tracks-page.ts` : `track.id`, `file?.name`, `response.items.length`.

Côté backend, la précaution existait déjà (commentaires explicites
`app.js:68-69` : « On ne logue jamais sa valeur, car un JWT permettrait une
usurpation »).

---

## Mission 7 — Tests automatisés

### Outillage mis en place

Trois obstacles rencontrés avant d'écrire la première assertion :

1. **`ng test` ne démarrait pas** : `Configuration 'development' for target
   'build' … is not set`. Le builder `@angular/build:unit-test` cible par défaut
   `gpc:build:development`, configuration absente de `angular.json`. Corrigé en
   déclarant explicitement `"buildTarget": "gpc:build"`.
2. **Aucun environnement DOM** : le runner Vitest exige `jsdom` ou `happy-dom`.
   `jsdom` ajouté en `devDependencies`.
3. **`localStorage` indisponible** : Node 26 expose un `localStorage` natif
   gated derrière `--localstorage-file`, et ce global **masque celui de jsdom**.
   Or `AuthService` lit `localStorage` dès l'initialisation de son champ `token`
   — sans correctif, le service n'était même pas instanciable. D'où
   `src/test-setup.ts`, déclaré en `setupFiles` : il installe une implémentation
   `Storage` en mémoire si le vrai `localStorage` est inutilisable. Aucun impact
   sur le code applicatif.

Également ajouté : `tsconfig.spec.json` (`types: []`, `include: src/**/*.ts`).

**Note d'exécution** : les tests doivent être lancés dans un terminal normal.
Ils échouent dans un environnement à bac à sable restreignant les IPC entre
processus (`[vitest-pool]: Failed to start forks worker`), ce qui n'a rien à voir
avec le code testé.

### Les tests frontend — 27 tests, 5 fichiers

Le sujet demande **au moins trois** tests parmi une liste. Les sept propositions
sont couvertes.

#### `auth.service.spec.ts` — 3 tests

| Test | Vérifie |
|---|---|
| `login()` appelle `POST /api/auth/login` avec email et mot de passe | URL, méthode `POST`, et corps `{ email, password }` exact |
| `login()` mémorise le token dans le Signal et dans `localStorage` | `token()`, `currentUser()?.name`, `localStorage.getItem('gpc_token')` |
| `logout()` efface le Signal et le `localStorage` | les trois remis à zéro |

#### `track.service.spec.ts` — 6 tests

| Test | Vérifie |
|---|---|
| `list()` transmet réellement `page` et `limit` | méthode, `params.get('page')`, `params.get('limit')`, et `urlWithParams === '/api/tracks?page=3&limit=10'` |
| `list()` utilise `page=1` et `limit=5` par défaut | les valeurs par défaut partent bien sur le réseau |
| `upload()` envoie un `FormData` avec exactement `audio` et `title` | `body instanceof FormData`, `body.get('title')`, nom du fichier, `[...body.keys()]` = exactement ces deux clés, **absence** de `Content-Type` posé à la main, `reportProgress === true` |
| `upload()` émet les événements de progression puis la réponse | un `UploadProgress` **et** un `Response` reçus, et plus d'une émission au total |
| `remove()` appelle `DELETE /api/tracks/:id` | URL et méthode `DELETE`, réponse `204` sans corps |
| `audio()` demande un `Blob` sur la route protégée | URL, `responseType === 'blob'` |

#### `auth.interceptor.spec.ts` — 3 tests

| Test | Vérifie |
|---|---|
| ajoute `Authorization` quand un token existe | header exactement `Bearer jeton-de-test` |
| n'ajoute rien en absence de token | `headers.has('Authorization') === false` |
| utilise le token **courant** | après deux `set()`, c'est le second qui part — l'intercepteur lit le Signal à chaque requête, il ne capture pas une valeur au démarrage |

#### `auth.guard.spec.ts` — 2 tests

| Test | Vérifie |
|---|---|
| laisse passer avec un token | retour `true` |
| redirige sans token | retour `instanceof UrlTree` et `router.serializeUrl(result) === '/login'` |

#### `tracks-page.spec.ts` — 13 tests

| Test | Vérifie |
|---|---|
| charge la première page au démarrage | `/api/tracks?page=1&limit=5`, `total`, `pages`, et le titre présent dans le DOM rendu |
| affiche une erreur après un échec HTTP | `error()` = message du serveur, liste vidée, **et** message réellement rendu dans un `[role="alert"]` |
| change de page en refaisant une requête | `pageIndex: 1` → `?page=2&limit=5` |
| refuse un fichier trop volumineux sans requête | fichier de 26 Mo → `fileError()`, `selectedFile()` vide, `expectNone('/api/tracks')` |
| refuse un format non audio sans requête | `.pdf` → message, aucune requête |
| met à jour la progression puis l'état de succès | événement `loaded: 512 / total: 1024` → `uploadProgress() === 50` ; après `Response` → `'success'`, 100 %, formulaire vidé, `page() === 1`, et rechargement de la liste |
| passe en état d'erreur avec le message du serveur | `400` → `'error'`, `uploadError()` = « Format audio non accepté », progression remise à `null`, champ titre réactivé |
| bloque une seconde soumission pendant un upload | deux `upload()` → une seule requête |
| la suppression confirmée appelle `DELETE` puis recharge | méthode `DELETE`, URL `/api/tracks/abc123`, puis nouveau `GET /api/tracks`, états remis à zéro, SnackBar appelé avec un message contenant « supprimé » |
| un `404` informe et resynchronise | message « n'existe plus », rechargement de la liste malgré l'erreur |
| bloque un second clic pendant une suppression | deux `confirmDelete()` → une seule requête |
| la lecture récupère un `Blob` et publie une `ObjectURL` | `responseType === 'blob'`, `createObjectURL` appelé, `currentTrack()` positionné, **et** `revokeObjectURL` appelé avec la bonne URL après `fixture.destroy()` |
| affiche une erreur si la lecture est refusée | `404` → message compréhensible, `loadingAudioId()` remis à `null` |

### Pourquoi ces tests n'ont pas besoin de MongoDB

Ils n'ont même pas besoin du backend. `provideHttpClientTesting()` remplace le
transport HTTP réel d'Angular par un faux transport que le test pilote :

```ts
TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting()],
});
```

À partir de là, aucune socket n'est ouverte. `httpTesting.expectOne(url)` récupère
la requête *que le code a voulu envoyer*, et le test l'inspecte, puis choisit
lui-même la réponse avec `flush()`. Ce qui est vérifié, c'est **le respect du
contrat par le client** : la bonne URL, la bonne méthode, les bons paramètres,
les bons en-têtes, et la bonne réaction à une réponse donnée. Rien de tout cela
ne dépend de l'endroit où les données sont stockées.

Autre bénéfice : on peut simuler à volonté des cas difficiles à provoquer pour
de vrai — un `500`, un `404` sur une piste supprimée entre-temps, un fichier de
26 Mo, un événement de progression à exactement 50 %. Reproduire cela avec un
vrai backend serait long et non déterministe.

`httpTesting.verify()` est appelé dans chaque `afterEach` : il fait échouer le
test si une requête a été émise sans être consommée. C'est ce qui garantit qu'il
n'y a **pas de requête parasite** — par exemple qu'un rechargement de liste a
bien lieu après une suppression, et une seule fois.

### Ce que vérifie un test d'intercepteur ou de guard

Ils ne testent pas une fonctionnalité visible, mais un **point de passage
transversal**.

Un **intercepteur** est une transformation : la requête que le service demande
n'est pas celle qui part sur le réseau. Le test envoie donc une requête réelle à
travers la chaîne et inspecte ce qui arrive **au transport**, pas ce que le
service a demandé. D'où le montage particulier :

```ts
provideHttpClient(withInterceptors([authInterceptor])),
provideHttpClientTesting(),
```

C'est le seul moyen d'attraper la requête *après* transformation. Le troisième
test est le plus intéressant : il change le token deux fois avant d'émettre, et
vérifie que c'est le second qui part. Il prouve que l'intercepteur lit le Signal
**à chaque requête** — un intercepteur qui aurait capturé le token une fois au
démarrage échouerait ici, et en production enverrait un token périmé après une
reconnexion.

Un **guard** est une fonction pure de décision : elle rend `true` ou une
redirection. Le test l'appelle directement dans un contexte d'injection
(`TestBed.runInInjectionContext`), sans naviguer, et vérifie la **valeur
rendue** — pas un effet de bord. D'où l'assertion sur le type `UrlTree` et sur
sa sérialisation `'/login'` : affirmer « ce n'est pas `true` » ne suffirait pas,
il faut vérifier *où* l'utilisateur est envoyé.

### Test unitaire et test d'intégration

| | Test unitaire | Test d'intégration |
|---|---|---|
| Périmètre | une unité isolée (un service, une fonction) | plusieurs pièces assemblées |
| Dépendances | remplacées par des doubles | réelles |
| Diagnostic en cas d'échec | immédiat : la faute est dans l'unité | il faut chercher laquelle des pièces a lâché |
| Vitesse | millisecondes | plus lent, parfois non déterministe |
| Ce que ça prouve | l'unité respecte son contrat | les pièces se parlent correctement |

Dans cette suite, les deux registres sont présents :

- **Plutôt unitaires** : `auth.service.spec.ts`, `track.service.spec.ts`,
  `auth.guard.spec.ts` — une seule classe ou fonction, HTTP simulé.
- **Plutôt intégration (côté frontend)** : `tracks-page.spec.ts` monte
  réellement le composant, son template, ses Signals, le vrai `TrackService`, le
  vrai `HttpClient`, et interroge le DOM produit
  (`querySelector('[role="alert"]')`). Seuls le transport réseau et le SnackBar
  sont doublés. `auth.interceptor.spec.ts` est aussi de ce type : il assemble la
  chaîne d'intercepteurs avec `HttpClient`.
- **Intégration complète (côté backend)** : `backend/test/api.test.js` démarre
  une vraie application Express sur un port éphémère et lui envoie de vraies
  requêtes `fetch`.

Ce qu'**aucun** de ces tests ne couvre : le parcours de bout en bout dans un
vrai navigateur avec une vraie base. Cela relèverait d'un test end-to-end
(Playwright, Cypress), hors périmètre de ce TP — et c'est ce que remplacent ici
les captures Network manuelles.

### Extension backend — 9 tests ajoutés

Ajoutés à la fin de `backend/test/api.test.js`, **sans toucher aux 2 tests
existants ni à aucune route**. Ils signent leurs propres JWT avec le même secret
par défaut que l'application (`npm test` ne charge pas `.env`, donc
`"tp1-development-secret"` des deux côtés) :

| Test | Attendu | Obtenu |
|---|---|---|
| `GET /api/tracks` sans JWT | `401 "Authentification requise"` | ✅ |
| `GET /api/tracks` avec JWT invalide | `401 "Jeton invalide ou expiré"` | ✅ |
| `GET /api/tracks` avec JWT signé par un autre secret | `401` | ✅ |
| `GET /api/tracks` sans le préfixe `Bearer` | `401 "Authentification requise"` | ✅ |
| `POST /api/tracks` sans fichier | `400 "Fichier audio requis"` | ✅ |
| `POST /api/tracks` avec type MIME refusé (`text/plain`) | `400 "Format audio non accepté"` | ✅ |
| `DELETE /api/tracks/:id` sans JWT | `401` | ✅ |
| `GET /api/tracks/:id/audio` sans JWT | `401` | ✅ |
| `PUT /api/users/me` sans JWT | `401` | ✅ |

**Pourquoi ces neuf-là et pas les autres de la liste du sujet.** Chacun est
rejeté **avant tout accès à MongoDB** : le middleware `auth` ne fait que vérifier
une signature, et Multer refuse un fichier absent ou mal typé avant le
`Track.create`. Ils tournent donc sans base, ce qui était la condition pour
qu'ils soient exécutables ici.

Les deux cas restants de la liste — « pagination avec `page` et `limit` » et
« accès interdit à la piste d'un autre utilisateur » — **exigent** une base
peuplée (créer deux utilisateurs, insérer des pistes). Ils sont donc laissés
de côté, ou à reprendre avec `mongodb-memory-server` : c'est le complément
naturel si vous voulez aller plus loin.

Le test « JWT signé par un autre secret » est celui qui mérite d'être commenté à
l'oral : il forge un token syntaxiquement valide, avec un `sub` et un `email`
crédibles, et il est quand même rejeté. C'est la démonstration que la sécurité
ne vient pas du *contenu* du token mais de sa **signature**, invérifiable sans le
secret qui reste sur le serveur.

---

## Vérifications finales

### Tests

```
$ cd frontend-starter && npm test
 Test Files  5 passed (5)
      Tests  27 passed (27)
```

```
$ cd backend && npm test
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

### Build

```
$ cd frontend-starter && npm run build
Initial chunk files | Names  |  Raw size | Estimated transfer size
main.js             | main   | 630.35 kB |               139.10 kB
styles.css          | styles |   8.69 kB |                 1.68 kB
                    | Initial total | 639.04 kB |            140.78 kB
Application bundle generation complete. [6.028 seconds]
```

Aucune erreur TypeScript, aucun avertissement de template. Le volume a augmenté
d'environ 60 kB par rapport au TP2 : c'est le coût de `@angular/material`
(paginator, progress bar, snack bar) et du CDK.

### Network — à capturer

| À vérifier | Attendu | Capture |
|---|---|---|
| Une requête `DELETE` après confirmation | `DELETE /api/tracks/<id>` → `204 No Content`, en-tête `Authorization: Bearer …` présent, suivie immédiatement d'un `GET /api/tracks?page=…` | [À COMPLÉTER] |
| Une requête d'upload et ses événements de progression | `POST /api/tracks`, `Content-Type: multipart/form-data; boundary=…`, `201`. La progression se lit dans la colonne Timing / Request sent, et surtout **dans l'interface** (barre + pourcentage). Prendre un fichier de quelques Mo, sinon 0 % → 100 % est instantané. Astuce : brider la connexion (« Slow 3G ») dans Network | [À COMPLÉTER] |
| Console sans erreur inattendue | Seuls les `console.debug` volontaires du code | [À COMPLÉTER] |
| Aucune donnée sensible journalisée | Ni mot de passe ni JWT dans la console — revue faite ci-dessus | ✅ revue de code |

---

## Restitution orale — les six points

Réponses résumées ; le détail est dans les sections correspondantes.

1. **Pourquoi la suppression passe par un service** — un seul endroit connaît le
   contrat HTTP, le composant reste testable sans HTTP, et les intercepteurs
   (JWT, traitement du `401`) restent en jeu. → Mission 5.
2. **Comment le backend protège la suppression** — `auth` vérifie la signature et
   l'expiration du JWT (`401` sinon), puis le filtre
   `findOneAndDelete({ _id, ownerId: req.auth.sub })` utilise le propriétaire
   **extrait du token**, pas celui envoyé par le client. Réponse `404`
   indifférenciée pour ne pas révéler l'existence d'un identifiant. → Mission 5.
3. **Comment Angular calcule le pourcentage d'upload** — il ne le calcule pas :
   avec `reportProgress: true` et `observe: 'events'`, il transmet des événements
   `UploadProgress` portant `loaded` et `total`. Le code fait
   `Math.round(100 * loaded / total)`, avec un repli si `total` est `undefined`.
   → Mission 6.
4. **Pourquoi les tests HTTP n'ont pas besoin de MongoDB** —
   `provideHttpClientTesting()` remplace le transport : aucune socket n'est
   ouverte, le test fournit lui-même les réponses. On vérifie le respect du
   contrat par le client, ce qui est indépendant du stockage. → Mission 7.
5. **Ce que vérifie un test d'intercepteur ou de guard** — l'intercepteur : que
   la requête est bien *transformée* (header ajouté, ou non), en inspectant ce
   qui atteint le transport ; le guard : la *valeur rendue* (`true` ou un
   `UrlTree` vers `/login`), sans naviguer. → Mission 7.
6. **Différence entre test unitaire et test d'intégration** — périmètre et
   dépendances : une unité isolée avec des doubles, contre plusieurs pièces
   réelles assemblées. Voir le tableau comparatif et le classement des fichiers
   de cette suite. → Mission 7.

---

## Livrables TP3

| Livrable | État |
|---|---|
| Suppression fonctionnelle d'une piste | Fait — commit `TP3 Mission 5` |
| Progression d'upload | Fait — commit `TP3 Mission 6` (pourcentage réel, pas seulement un état) |
| Au moins trois tests frontend | Fait — **27 tests** dans 5 fichiers |
| Rapport des tests avec résultats attendus et observés | Fait — tableaux de la Mission 7 |
| Capture Network d'une suppression et d'un upload | [À COMPLÉTER] |
| `npm run build` exécuté | Fait — sortie reproduite ci-dessus |
| Rapport IA fondé sur `RAPPORT_IA_MODELE.md` | Fait — voir `RAPPORT_IA_MODELE.md`, Missions 2, 3, 5, 6 et 7 |
