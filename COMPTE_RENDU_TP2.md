# Compte-rendu TP2 — Bibliothèque, upload et lecture audio

Ce fichier reprend les questions et les livrables de `SUJET_ETUDIANT_TP2.md`.
Les captures d'écran mentionnées doivent être ajoutées au projet (par exemple
dans un dossier `captures/`) puis liées avec
`![légende](captures/nom-du-fichier.png)`.

**État de vérification au moment de la rédaction** : `npm run build` passe
(bundle généré en ~13 s) et les 32 tests frontend du TP3 passent. En revanche le
cluster MongoDB Atlas du fichier `backend/.env` n'était **pas joignable** depuis
la machine (`querySrv ECONNREFUSED _mongodb._tcp.cluster0.xb7iesh.mongodb.net`,
cluster probablement en pause) : les captures Network du checkpoint restent donc
à produire après avoir redémarré le cluster. Tout ce qui est marqué
`[À COMPLÉTER]` correspond à ces preuves d'exécution.

---

## Mission 2 — Bibliothèque paginée

### Le flux demandé

```text
TracksPageComponent.load()          (tracks-page.ts:132)
  → TrackService.list(page, limit)  (track.service.ts:11)
    → HttpClient.get('/api/tracks', { params: { page, limit } })
      → GET /api/tracks?page=...&limit=...
        → app.js:286  (Track.find().skip().limit() + countDocuments)
```

`TrackService.list(page, limit)` transmet réellement les deux paramètres via
l'option `params` de `HttpClient` :

```ts
// frontend-starter/src/app/shared/services/track.service.ts:11
list(page = 1, limit = 5) {
  return this.http.get<Page<Track>>('/api/tracks', {
    params: { page, limit },
  });
}
```

C'est vérifié automatiquement par un test qui inspecte l'URL réellement
envoyée (`track.service.spec.ts`) :

```ts
expect(request.request.urlWithParams).toBe('/api/tracks?page=3&limit=10');
```

### L'état représenté avec des Signals

Tous dans `tracks-page.ts:60-66` :

| Signal | Rôle | Source |
|---|---|---|
| `tracks` | la liste affichée | `response.items` |
| `page` | page courante (base 1) | envoyé au serveur, puis réaligné sur `response.page` |
| `limit` | taille de page | envoyé au serveur, puis réaligné sur `response.limit` |
| `total` | nombre total de pistes | `response.total` |
| `pages` | nombre total de pages | `response.pages` |
| `loading` | état de chargement | mis à `true` avant l'appel, `false` dans `next` **et** dans `error` |
| `error` | message d'erreur éventuel | `error.error?.message` sinon message par défaut |

Un point volontaire : après chaque réponse, `page` et `limit` sont **réécrits
avec les valeurs renvoyées par le serveur** (`tracks-page.ts:142-145`). Le backend
borne en effet ces paramètres (`app.js:273-274` : `page >= 1`,
`1 <= limit <= 20`). Si l'interface demandait `limit=500`, le serveur en
appliquerait 20 ; sans ce réalignement, l'interface afficherait un état faux.

### Affichage : `@for`, `@empty`, `@if`

- `@for (track of tracks(); track track.id)` — `tracks-page.html:141`
- `@empty` — affiche « Aucune piste pour le moment. » et invite à importer
  (`tracks-page.html:231-237`), et seulement si on n'est pas en erreur : sinon
  deux messages contradictoires s'afficheraient en même temps.
- `@if (loading())` — affiche quatre cards « squelettes » animées à la place de
  la liste (`tracks-page.html:130-138`), ce qui évite un saut de mise en page
  quand les vraies cards arrivent. Le message textuel destiné aux lecteurs
  d'écran est porté par un `role="status"` en `.sr-only` : visuellement inutile
  puisque les squelettes sont déjà parlants, mais indispensable à l'oral.
- `@if (error())` — message d'erreur avec `role="alert"` (`tracks-page.html:127`)

### Boutons « Précédent » / « Suivant » désactivés aux bornes

Ils sont fournis par le **Paginator Angular Material** (`tracks-page.html:246`),
qui est exactement le composant demandé dans la partie AVANCÉ du sujet :

```html
<mat-paginator
  [length]="total()"
  [pageSize]="limit()"
  [pageIndex]="page() - 1"
  [pageSizeOptions]="pageSizeOptions"
  [disabled]="loading()"
  (page)="onPageChange($event)"
  aria-label="Pagination de la bibliothèque"
/>
```

Le paginator rend deux boutons `Previous page` / `Next page` qu'il désactive
lui-même sur la première et la dernière page, à partir de `[length]` et
`[pageSize]`. Il ajoute aussi le sélecteur de taille de page (5, 10, 20 — 20
étant le maximum accepté par le backend, `app.js:274`).

Un piège à connaître : **le paginator compte les pages à partir de 0**
(`pageIndex`) alors que l'API compte à partir de 1 (`page`). La conversion est
faite explicitement dans les deux sens :

```ts
// tracks-page.ts:161 — du paginator vers l'API
onPageChange(event: PageEvent): void {
  this.page.set(event.pageIndex + 1);
  this.limit.set(event.pageSize);
  this.load();
}
```
```html
<!-- du signal vers le paginator -->
[pageIndex]="page() - 1"
```

Le bloc de statistiques de l'en-tête de page double l'information sous forme
lisible : « Pistes : 12 » et « Page : 2/3 » (`tracks-page.html:9-18`). Le
nombre de pages vient de `pages()`, donc du serveur.

### Une requête HTTP par changement de page

`onPageChange()` se termine par `this.load()`, qui refait un `GET` complet. Il
n'y a **aucun découpage local** : le composant ne possède jamais plus que les
`limit` pistes de la page courante, et aucun `slice()` n'apparaît dans le code.

Test automatisé correspondant (`tracks-page.spec.ts`) :

```
component.onPageChange({ pageIndex: 1, pageSize: 5, length: 12 });
→ nouvelle requête '/api/tracks?page=2&limit=5'
```

### AVANCÉ — Pagination Mongoose `aggregate-paginate-v2`

**Non réalisée.** C'est une option facultative du sujet, et elle imposerait de
modifier le backend, la forme de `Page<Track>`, `API_CONTRACT.md` et le
frontend. La pagination actuelle utilise `skip()` / `limit()` +
`countDocuments()` parallélisés par `Promise.all` (`app.js:286-292`), ce qui
répond au contrat existant.

---

## Mission 3 — Analyse du mécanisme d'upload et de lecture

### Où se trouve chaque étape ?

| Étape | Fichier et méthode |
|---|---|
| Choix du fichier | `tracks-page.html:41` (`<input type="file" (change)="choose($event)">`) puis `choose()` (`tracks-page.ts:168`), qui délègue à `selectFile()` (`tracks-page.ts:196`) — point d'entrée commun avec le glisser-déposer |
| Construction du `FormData` | `track.service.ts:31-33` (`new FormData()`, `append('audio', file)`, `append('title', title)`) |
| Appel HTTP d'upload | `track.service.ts:34` (`http.post<Track>('/api/tracks', body, …)`) |
| Réception côté serveur | `app.js:337` (`upload.single("audio")`) → `req.file`, `req.body.title` |
| Récupération du `Blob` | `track.service.ts:40-43` (`http.get(..., { responseType: 'blob' })`) |
| Création de l'`ObjectURL` | `tracks-page.ts:289` (`URL.createObjectURL(blob)`) |
| Affectation au lecteur | `tracks-page.html:354` (`<audio [src]="audioUrl()">`) |
| Révocation de l'ancienne URL | `tracks-page.ts:288` (`releaseAudioUrl()` avant chaque nouvelle création) et `tracks-page.ts:491-496` |
| Révocation de la **dernière** URL | `tracks-page.ts:116` (`destroyRef.onDestroy(() => this.releaseAudioUrl())`) |
| Ajout du JWT | `auth.interceptor.ts:6-15` |

### Les deux flux

**Envoi** (composant → service → HttpClient → API) :

```text
<input type="file">  →  choose()  →  selectedFile (Signal)
  →  upload()  →  TrackService.upload(file, title)
      →  new FormData() : append('audio', file) + append('title', title)
      →  HttpClient.post('/api/tracks', formData)
         (authInterceptor ajoute Authorization: Bearer <token>)
         →  POST /api/tracks  (multipart/form-data)
            →  Multer : fileFilter → diskStorage → req.file
            →  Track.create({...})  →  201 Track
```

**Lecture** (API → `Blob` → `ObjectURL` → lecteur) :

```text
clic ▶  →  play(track)  →  TrackService.audio(id)
  →  HttpClient.get('/api/tracks/:id/audio', { responseType: 'blob' })
     (authInterceptor ajoute Authorization: Bearer <token>)
     →  GET /api/tracks/:id/audio  →  res.sendFile(...)  →  octets
  →  Blob reçu par le composant
  →  révocation de l'ancienne ObjectURL
  →  URL.createObjectURL(blob)  →  Signal audioUrl
  →  <audio [src]="audioUrl()">  →  le navigateur lit un blob: local
```

### L'intercepteur et le cas d'une URL placée directement dans `src`

`authInterceptor` (`auth.interceptor.ts:6`) est enregistré dans `main.ts` via
`provideHttpClient(withInterceptors([authInterceptor, authErrorInterceptor]))`.
Il intercepte **chaque requête passant par `HttpClient`**, clone la requête et
lui ajoute `Authorization: Bearer <token>` quand un token existe.

C'est là le point clé : **il n'intercepte que `HttpClient`**.

Si on écrivait directement :

```html
<!-- ne fonctionnerait pas -->
<audio src="/api/tracks/abc123/audio"></audio>
```

c'est **le navigateur**, et non Angular, qui émettrait la requête — au titre du
chargement d'une sous-ressource du document, exactement comme pour une balise
`<img>`. Cette requête ne traverse ni `HttpClient`, ni la chaîne
d'intercepteurs : Angular n'a aucun moyen d'y greffer un en-tête. Or l'API
HTML ne permet pas de déclarer des en-têtes sur l'attribut `src` (seuls des
mécanismes portés par le navigateur voyagent : cookies, `crossorigin`,
`referrerpolicy`). Le serveur recevrait donc une requête sans `Authorization`
et le middleware `auth` (`app.js:61-68`) répondrait `401`.

D'où le détour par `Blob` + `ObjectURL` : on fait la requête *authentifiée* en
JavaScript, puis on donne au lecteur une URL `blob:` locale, qui ne déclenche
plus aucun appel réseau.

Les alternatives existent mais ont chacune un coût : authentification par
cookie (la balise `<audio>` l'enverrait seule, mais il faut traiter le CSRF), ou
URL signée à durée de vie courte passée en query string (le token sort alors des
en-têtes et se retrouve dans les journaux et l'historique). Le contrat de ce TP
impose `Authorization: Bearer`, donc `Blob` + `ObjectURL`.

### Contrôles déjà présents côté backend

| Contrôle | Emplacement |
|---|---|
| Le multipart contient bien le champ `audio` | `app.js:337` (`upload.single("audio")`) puis `app.js:340-343` (`if (!req.file)` → `400 "Fichier audio requis"`) |
| Lecture du champ `title` | `app.js:347` (`req.body.title || req.file.originalname`) |
| Formats audio acceptés | `app.js:34-41` (Set `allowed`) utilisé par `fileFilter` (`app.js:109-119`) → `400 "Format audio non accepté"` |
| Taille maximale 25 Mo | `app.js:31` (`MAX_FILE_SIZE`) + `app.js:108` (`limits: { fileSize: MAX_FILE_SIZE }`) → `MulterError` traduit en `400` (`app.js:445-449`) |
| Propriété de la piste à la lecture | `app.js:381-388` (`Track.findOne({ _id, ownerId: req.auth.sub })`) |

Vérification demandée côté frontend : le `FormData` contient **exactement**
`audio` et `title`, et rien d'autre. C'est assuré par `track.service.ts:31-33`
et vérifié automatiquement :

```ts
expect([...body.keys()].sort()).toEqual(['audio', 'title']);
```

Un autre test vérifie qu'aucun `Content-Type` n'est posé à la main : c'est
volontaire, le navigateur doit le générer lui-même car il doit y inscrire la
`boundary` qui sépare les parties du multipart. Le forcer casserait le parsing
côté Multer.

### Ce qui a été ajouté côté frontend

**1. Validation avant l'appel HTTP** — nouveau fichier
`frontend-starter/src/app/shared/audio-constraints.ts`. Il recopie les règles du
backend (`MAX_AUDIO_SIZE = 25 * 1024 * 1024`, la même liste de types MIME) et
expose `validateAudioFile(file)` qui renvoie un message lisible ou `null`.
Appelé à la sélection (`tracks-page.ts:205`, dans `selectFile()`) **et** juste
avant l'envoi (`tracks-page.ts:220`). Un fichier refusé n'est pas conservé : le bouton
« Envoyer » reste inactif.

Détail utile : certains navigateurs ne renseignent pas `File.type`. Dans ce cas
la validation retombe sur l'extension (`.mp3`, `.wav`, `.ogg`, `.m4a`) plutôt
que de refuser un fichier correct.

**Pourquoi cette validation ne remplace jamais celle du backend.** Elle
s'exécute dans le navigateur, c'est-à-dire chez le client, sur du code qu'il
contrôle entièrement. N'importe qui peut appeler `POST /api/tracks` avec `curl`,
Postman ou du JavaScript modifié dans la console, sans jamais exécuter cette
fonction. La validation frontend est une **amélioration de l'expérience** : elle
évite d'attendre l'envoi de 25 Mo pour apprendre que le fichier est refusé, et
donne un message immédiat. La validation backend est une **règle de sécurité et
d'intégrité** : c'est la seule qui soit réellement appliquée, parce qu'elle
tourne sur une machine que l'utilisateur ne contrôle pas. Règle générale : tout
contrôle client est une courtoisie, tout contrôle serveur est une garantie.

**2. Interface pendant l'envoi**

| Exigence | Réalisation |
|---|---|
| État de chargement | `uploadState()` (`'idle' \| 'uploading' \| 'success' \| 'error'`) + barre de progression, `tracks-page.html:90-114` |
| Bouton désactivé, pas de double soumission | `[disabled]="!selectedFile() \|\| uploading()"` (`tracks-page.html:83`) **et** garde `if (!file \|\| this.uploading()) return;` dans le code (`tracks-page.ts:218`) |
| Erreurs du serveur affichées | `uploadError()` alimenté par `error.error?.message` (`tracks-page.ts:272`) |
| Message de succès | `uploadSuccess()` : « « <titre> » a été ajouté à votre bibliothèque. » |
| Formulaire vidé | `resetUploadForm()` : `title.setValue('')`, `selectedFile.set(undefined)`, **et** remise à zéro de `input.value` du DOM (un `<input type="file">` ne se vide pas autrement) |
| Retour en première page | `page.set(1)` puis `load()` (les pistes sont triées par `createdAt: -1`, `app.js:287` : la nouvelle est donc en page 1) |

Le champ « Titre » est désactivé par l'API du formulaire réactif
(`title.disable()` / `title.enable()`) et non par un attribut `[disabled]` dans
le template : avec les Reactive Forms, c'est le `FormControl` qui possède l'état
du contrôle, et mélanger les deux produit un avertissement Angular.

**3. Cards responsives et accessibles** (`tracks-page.html:140-243`,
`tracks-page.css`)

Chaque card affiche le titre, le nom d'origine, le format (`MP3`, `WAV`, `OGG`,
`M4A` — traduit depuis le type MIME), la taille formatée (`1,4 Mo` plutôt que
`1468006`), la date d'ajout en français, et l'action de lecture.

Choix d'accessibilité :
- liste sémantique `<ul role="list">` / `<li>` : un lecteur d'écran annonce
  « liste de N éléments » plutôt qu'une suite de `<div>` ;
- `<h3>` pour le titre de chaque card, sous le `<h2>` « Mes pistes » ;
- `aria-label` explicite sur chaque bouton (« Lire Blues en La ») : « ▶ » seul
  ne dit rien à l'oral ;
- piste en cours signalée par `aria-current` **et** par un badge textuel
  (« En lecture » / « En pause »), pas seulement par la couleur de la bordure ;
- `aria-live="polite"` sur les zones de statut, `role="alert"` sur les erreurs ;
- `:focus-visible` avec un anneau de 2 px sur tous les éléments interactifs ;
  la zone de dépôt le reçoit via `:focus-within`, puisque son `<input file>` est
  masqué visuellement (`.sr-only`) tout en restant focalisable ;
- grille `repeat(auto-fill, minmax(250px, 1fr))` au-delà de 620 px, une seule
  colonne en dessous ; `overflow-wrap: anywhere` pour les noms de fichiers longs ;
- animations neutralisées sous `prefers-reduced-motion: reduce`.

**4. Lecture complétée**

- morceau en cours affiché : Signal `currentTrack`, lu par la barre de lecture
  fixée en bas d'écran (`tracks-page.html:266-292`) ;
- erreur audio compréhensible : deux sources distinctes — l'échec HTTP
  (`tracks-page.ts:292-303`, message dédié pour un `404` : « Cette piste
  n'existe plus ou ne vous appartient pas. ») et le refus du lecteur lui-même
  (`(error)="onAudioError()"` sur la balise `<audio>`, `tracks-page.ts:459`) ;
- `loadingAudioId` désactive les boutons ▶ pendant le téléchargement, pour
  éviter deux téléchargements simultanés ;
- révocation de l'`ObjectURL` finale à la destruction du composant
  (`tracks-page.ts:116`).

**Barre de lecture fixée en bas d'écran.** L'élément `<audio>` ne porte plus
l'attribut `controls` : les commandes (lecture/pause, barre de progression,
temps écoulé et total, volume) sont dessinées par l'application et pilotent le
même élément. Ce qui compte pour la mission ne change pas — c'est toujours un
`<audio>` dont le `src` reçoit l'`ObjectURL` d'un `Blob` téléchargé de façon
authentifiée. Les Signals `isPlaying`, `currentTime`, `duration` et `volume`
sont alimentés par les **événements** de l'élément (`loadedmetadata`,
`timeupdate`, `play`, `pause`, `ended`) : l'élément reste la source de vérité du
son, l'interface ne fait que le refléter. Voir la section « Refonte de
l'interface » en fin de document.

### Téléchargement complet d'un `Blob`, buffering, streaming

Ce sont trois choses différentes, et c'est la première que ce projet utilise.

1. **Téléchargement complet d'un `Blob`** — ce que fait le code. `HttpClient`
   avec `responseType: 'blob'` attend d'avoir reçu **tout** le corps de la
   réponse avant d'émettre une valeur. Le fichier entier est alors en mémoire
   dans le navigateur, sous forme de `Blob`. La lecture ne commence qu'après.
   Conséquence : sur un fichier de 20 Mo et une connexion lente, l'utilisateur
   attend, sans aucun son, puis tout est instantané.

2. **Buffering du navigateur** — ce que fait un `<audio>` branché sur une URL
   HTTP. Le navigateur ne charge pas tout : il remplit un tampon d'avance de
   lecture, commence à jouer dès qu'il en a assez, et continue à télécharger
   pendant la lecture. C'est lui qui gère le tampon, pas le code JavaScript.
   Avec une URL `blob:`, il n'y a plus rien à bufferiser : les octets sont déjà
   locaux.

3. **Streaming côté serveur** — ce que le serveur sait faire, indépendamment du
   client. `res.sendFile()` (`app.js:394`) ouvre un flux de lecture sur le
   fichier et le pipe vers la réponse : le serveur ne charge jamais les 20 Mo en
   RAM. Il annonce également `Accept-Ranges: bytes` et honore l'en-tête `Range`,
   ce qui permet à un client de ne demander qu'un morceau du fichier (c'est ce
   qui rend le déplacement dans la barre de lecture possible sans tout
   télécharger).

Autrement dit : **le serveur est capable de streamer, mais le client choisi ici
ne streame pas.** `responseType: 'blob'` consomme la réponse d'un bloc. Le
serveur n'y perd rien en mémoire ; c'est le navigateur qui stocke tout.

---

## Questions sur mémoire, buffering et streaming

**Le backend envoie-t-il le fichier entier en mémoire ou peut-il l'envoyer
progressivement depuis le disque ?**

Progressivement depuis le disque. La route de lecture utilise
`res.sendFile(audioPath, callback)` (`app.js:394`), qui s'appuie sur le module
`send` d'Express : celui-ci ouvre un flux de lecture (`fs.createReadStream`) et
le pipe vers la réponse HTTP. Le fichier n'est jamais chargé intégralement en
RAM côté serveur, et le débit s'adapte à celui du client (contre-pression du
flux). Deux indices supplémentaires dans le code : le fichier est stocké **sur
le disque** et non en base (`multer.diskStorage`, `app.js:88` ; seul
`storedName` est en MongoDB, `models/Track.js:18`), et `res.sendFile` gère
nativement les requêtes `Range`. À l'inverse, un `fs.readFile()` suivi d'un
`res.send(buffer)` aurait, lui, chargé tout le fichier en mémoire.

**Avec `HttpClient` et `responseType: "blob"`, à quel moment le composant
reçoit-il généralement le fichier ?**

À la toute fin : quand la réponse est **complètement** téléchargée. L'Observable
retourné par `TrackService.audio()` (`track.service.ts:40`) n'émet qu'une seule
valeur, et il l'émet une fois le corps entier reçu et converti en `Blob`. Le
callback `next` de `play()` (`tracks-page.ts:283`) ne s'exécute donc pas avant
le dernier octet. Rien n'est jouable pendant le transfert. Si l'on voulait
suivre l'avancement, il faudrait ici aussi passer par `observe: 'events'` et
`reportProgress: true` — ce qui donnerait des événements `DownloadProgress`,
utiles pour afficher une barre, mais toujours pas de lecture progressive.

**Si la bibliothèque contient 100 morceaux, les 100 fichiers audio sont-ils
chargés en mémoire dès l'affichage de la liste ?**

Non. Justification à partir du code :

1. l'affichage de la liste appelle `TrackService.list()` (`tracks-page.ts:136`),
   qui interroge `GET /api/tracks` ; cette route renvoie **uniquement des
   métadonnées JSON** (`app.js:295-299` : `id`, `title`, `originalName`,
   `mimeType`, `size`, `createdAt`) — aucun octet audio ;
2. la seule requête qui rapporte de l'audio est `TrackService.audio(id)`
   (`track.service.ts:40`), et le seul appelant est `play(track)`
   (`tracks-page.ts:278`), déclenché par un clic sur ▶ ;
3. le template ne contient **qu'un seul** élément `<audio>`, rendu
   conditionnellement (`@if (audioUrl())`, `tracks-page.html:266`) et lié à
   l'unique Signal `audioUrl`. Il n'y a pas d'élément `<audio>` par card.

Et avec la pagination, la liste n'affiche de toute façon que 5 à 20 pistes à la
fois. Au maximum **un** fichier audio est en mémoire à un instant donné, celui
qu'on écoute — puisque l'`ObjectURL` précédente est révoquée avant d'en créer
une nouvelle (`tracks-page.ts:288`).

**Quelle différence y aurait-il avec 100 éléments `<audio>` utilisant
directement une URL HTTP ?**

Sur la mémoire, ce serait plutôt meilleur : avec `preload="metadata"` (le
défaut), le navigateur ne récupère que l'en-tête de chaque fichier pour
connaître sa durée, et ne télécharge le contenu qu'à la lecture. Aucun `Blob`
complet ne serait retenu par du code JavaScript, le navigateur gérerait ses
tampons et les libérerait seul, et le déplacement dans la piste utiliserait des
requêtes `Range` au lieu d'un téléchargement intégral.

Mais ce serait **cassé** ici, pour deux raisons :

1. ces 100 requêtes seraient émises par le navigateur, pas par `HttpClient` :
   pas d'`Authorization`, donc 100 réponses `401` (`app.js:61-68`) — c'est le
   point développé plus haut ;
2. même en réglant l'authentification autrement (cookie, URL signée), 100
   éléments média créent 100 connexions potentielles et autant de décodeurs :
   les navigateurs limitent le nombre de requêtes simultanées par origine, et
   `preload="auto"` sur 100 éléments saturerait la bande passante.

En résumé, la solution `Blob` échange de la mémoire et de la latence contre la
possibilité d'authentifier la requête par en-tête.

**Pourquoi l'URL créée par `URL.createObjectURL` doit-elle être révoquée ?**

Parce qu'elle crée une référence forte, détenue par le document, vers le `Blob`.
Tant que l'URL existe, le ramasse-miettes ne peut pas libérer les octets, même
si plus aucune variable JavaScript ne pointe sur le `Blob`, même si l'élément
`<audio>` a disparu du DOM. Cette référence vit jusqu'au déchargement complet du
document : dans une application Angular, qui ne recharge jamais la page,
« jusqu'au déchargement » veut dire « jusqu'à ce que l'utilisateur ferme
l'onglet ». Sans révocation, écouter 30 morceaux de 8 Mo laisserait ~240 Mo de
`Blob` vivants.

D'où les deux endroits où `revokeObjectURL` est appelé :

- `tracks-page.ts:288`, avant chaque nouvelle création — l'URL précédente ne
  sert plus dès qu'on change de morceau ;
- `tracks-page.ts:116`, via `destroyRef.onDestroy()` — la **dernière** URL, que
  plus aucun `play()` ne viendra remplacer, est libérée quand on quitte la page.

Le second cas est celui qu'on oublie, et il est couvert par un test
(`tracks-page.spec.ts`) qui espionne `URL.revokeObjectURL` et détruit le
composant :

```ts
fixture.destroy();
expect(revokeSpy).toHaveBeenCalledWith('blob:fausse-url');
```

---

## Améliorations facultatives

| Amélioration | État |
|---|---|
| Formatage lisible de la taille et de la date | **Fait** (`audio-constraints.ts` : `formatSize`, `formatAudioType` ; `formatDate` dans le composant) |
| Barre de progression de l'upload | **Fait** — traité en TP3 Mission 6 (voir `COMPTE_RENDU_TP3.md`) |
| Suppression avec confirmation + rafraîchissement | **Fait** — traité en TP3 Mission 5 |
| Filtre par titre | Non fait (l'API n'expose pas de paramètre de recherche ; il faudrait modifier le backend et `API_CONTRACT.md`) |
| AVANCÉ — image de couverture / tags ID3 | Non fait (nécessite une modification du modèle de données et de l'API) |

---

## Checkpoint Network — à capturer

Le cluster Atlas étant injoignable au moment de la rédaction, ces preuves
restent à produire. Démarche : `npm start` dans `backend/`, `npm start` dans
`frontend-starter/`, se connecter avec `demo@example.com` / `Demo1234!`, puis
ouvrir l'onglet Network (case « Preserve log » cochée).

| À vérifier | Attendu | Capture |
|---|---|---|
| Chaque changement de page modifie `page` | `GET /api/tracks?page=1&limit=5` puis `?page=2&limit=5` — deux requêtes distinctes | [À COMPLÉTER] |
| L'upload est bien multipart avec `audio` et `title` | `POST /api/tracks`, `Content-Type: multipart/form-data; boundary=...`, onglet Payload montrant les deux champs | [À COMPLÉTER] |
| La réponse de lecture est un flux audio | `GET /api/tracks/:id/audio` → `200`, `Content-Type: audio/mpeg`, taille = celle du fichier | [À COMPLÉTER] |
| Une erreur `400` est affichée pour un fichier invalide | Tenter un `.pdf` : bloqué **avant** la requête par la validation frontend (message « Format non accepté »). Pour voir le `400` du serveur, envoyer via `curl` sans passer par l'interface | [À COMPLÉTER] |
| Une piste ne peut être lue que par son propriétaire | Avec le token de l'utilisateur A, appeler `/api/tracks/<id-de-B>/audio` → `404 { "message": "Piste inconnue" }` | [À COMPLÉTER] |

Le dernier point mérite un mot : le backend répond `404` et non `403`
(`app.js:381-388`). C'est volontaire — un `403` confirmerait à un attaquant que
l'identifiant existe. Le filtre `Track.findOne({ _id, ownerId: req.auth.sub })`
fait que « la piste n'existe pas » et « la piste n'est pas à vous » deviennent
indistinguables de l'extérieur.

**Sécurité des captures** : ne jamais joindre un export `.har` brut au rendu. Il
contient le mot de passe en clair dans le corps de `POST /api/auth/login` et le
JWT complet dans la réponse. Masquer ces valeurs, ou ne fournir que des captures
d'écran recadrées.

---

## Livrables TP2

| Livrable | État |
|---|---|
| Code frontend complété | Fait — commits `TP2 Mission 2` et `TP2 Mission 3` |
| Cards de bibliothèque lisibles | Fait — `tracks-page.html` / `tracks-page.css` |
| Capture Network de la pagination ou de l'upload | [À COMPLÉTER] |
| Capture ou démonstration de la lecture audio authentifiée | [À COMPLÉTER] |
| Explication écrite du choix `Blob` et `ObjectURL` | Fait — section « L'intercepteur et le cas d'une URL placée directement dans `src` » |
| Réponses aux questions mémoire / buffering / streaming | Fait — section dédiée |

Voir `RAPPORT_IA_MODELE.md` pour les prompts, les plans proposés par l'agent et
les fichiers modifiés.

---

## Refonte de l'interface

Travail mené après les missions, à la demande du binôme : moderniser la page et
rendre le lecteur audio visible en permanence. Aucune route, aucun contrat HTTP
et aucun comportement métier ne changent — les 32 tests frontend et les 11 tests
backend passent avant comme après.

### Parti pris : un thème sombre

L'application est un lecteur audio doté d'une barre de lecture fixée en bas
d'écran : un fond sombre garde l'attention sur le contenu et les commandes, et
c'est la convention des lecteurs du marché.

Toutes les couleurs passent par des variables CSS déclarées dans `styles.css`
(`--bg`, `--surface`, `--border`, `--text`, `--accent`…). Le vert de la charte
d'origine (`#1d755e`) est conservé comme couleur d'accent mais remonté en
luminosité (`#3ddc97`) : sur fond sombre, le vert d'origine n'aurait pas eu un
contraste suffisant.

**Point technique à connaître** : le thème Angular Material utilisé
(`azure-blue.css`) est un thème **clair**, et il ne contient aucune règle
`prefers-color-scheme`. Il fonctionne entièrement par jetons `--mat-sys-*`, que
`styles.css` réécrit donc pour que le Paginator, la barre de progression et le
SnackBar suivent la même charte. Les jetons concernés ont été relevés dans les
bundles des composants réellement utilisés :

| Composant | Jetons lus |
|---|---|
| SnackBar | `inverse-surface`, `inverse-on-surface`, `inverse-primary` |
| Paginator (et son `mat-select`) | `surface`, `on-surface`, `on-surface-variant`, `surface-container`, `primary` |
| Progress bar | `primary`, `surface-variant` |

Le SnackBar reste volontairement **clair sur fond sombre** : c'est la convention
Material 3 (surface « inversée »), et cela le rend immédiatement repérable.

`color-scheme: dark` est déclaré sur `:root` pour que les éléments natifs que le
CSS ne contrôle pas — barres de défilement, curseurs `input[type=range]` — soient
rendus dans leur variante sombre par le navigateur.

### La barre de lecture

Fixée en bas de la fenêtre (`position: fixed; inset: auto 0 0 0`), elle est
**toujours affichée**, y compris quand rien ne joue : dans ce cas elle indique
« Aucune lecture en cours » et ses commandes sont désactivées, avec une opacité
réduite. L'utilisateur sait ainsi toujours où trouver les commandes.

Deux détails qui ne se voient pas mais comptent :

1. **L'espace est réservé en bas de page.** Un élément `position: fixed` sort du
   flux : sans précaution, la dernière card passerait sous la barre. La hauteur
   est donc déclarée une seule fois en variable (`--player-height`) et le
   composant réserve cet espace par `padding-bottom` sur `:host`. La variable est
   redéfinie à 132 px sous 720 px de large, où la barre empile ses trois blocs.
2. **L'élément `<audio>` n'est rendu qu'une fois une URL disponible**
   (`@if (audioUrl())`). Un `src` vide serait résolu par le navigateur comme
   l'URL de la page elle-même, ce qui déclencherait un événement `error` et
   afficherait un message d'erreur audio alors que rien ne s'est passé.

Les commandes maison (lecture/pause, progression, temps, volume) pilotent
l'élément `<audio>` sans le remplacer. Précaution ajoutée dans `requestPlay()` :
`element.play()` renvoie une Promise **ou** `undefined` selon l'implémentation,
et sa Promise peut être rejetée (politique de lecture automatique du navigateur).
Le retour est donc testé avant d'être enchaîné, et le rejet est traité.

### Autres changements visibles

| Élément | Avant | Après |
|---|---|---|
| En-tête | bandeau statique | barre collante (`sticky`) avec flou d'arrière-plan et onglet courant marqué par `routerLinkActive` |
| Import | `<input type="file">` nu | zone de dépôt avec **glisser-déposer**, l'`<input>` restant présent et focalisable (`.sr-only` + `<label for>`) |
| Chargement | texte « Chargement… » | quatre cards « squelettes » animées, plus un `role="status"` pour les lecteurs d'écran |
| Cards | lignes de texte | cards en grille, bouton de lecture rond, étiquettes format / taille / date, badge « En lecture » |
| Lecteur | `<audio controls>` sous la liste | barre fixe en bas d'écran avec commandes maison |
| Pagination | compteur textuel sous la liste | bloc de statistiques dans l'en-tête de page |
| Login / inscription / profil | formulaires bruts | mêmes cards, libellés reliés par `for`/`id`, attributs `autocomplete`, avatar à initiale sur le profil |

Le **glisser-déposer** passe par le même point d'entrée que le sélecteur natif
(`selectFile()`), donc par la même validation `validateAudioFile()`. Il n'y a pas
deux chemins de validation à maintenir, et le test de la suite frontend le
vérifie explicitement pour les deux origines.

### Accessibilité

La refonte n'échange pas l'accessibilité contre l'esthétique :

- aucune information portée par la seule couleur — la piste en cours a une
  bordure **et** un badge textuel, l'upload a un pourcentage **et** une barre ;
- anneau de focus visible sur tout élément interactif, y compris sur la zone de
  dépôt via `:focus-within` ;
- libellés `aria-label` sur les commandes icôniques du lecteur, dont le texte
  change avec l'état (« Mettre en pause » / « Reprendre la lecture ») ;
- icônes en SVG inline avec `aria-hidden="true"` : décoratives, jamais annoncées ;
- `prefers-reduced-motion: reduce` neutralise les animations (squelettes,
  égaliseur, transitions).

### Fichiers touchés par la refonte

- `frontend-starter/src/styles.css` (réécrit : variables de thème, jetons Material)
- `frontend-starter/src/app/components/app/app.html` / `.css` / `.ts` (`RouterLinkActive`)
- `frontend-starter/src/app/components/tracks-page/tracks-page.html` / `.css` / `.ts`
- `frontend-starter/src/app/components/login-page/login-page.html` / `.css`
- `frontend-starter/src/app/components/register-page/register-page.html` / `.css`
- `frontend-starter/src/app/components/profile-page/profile-page.html` / `.css`
- `frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts` (5 tests ajoutés)
