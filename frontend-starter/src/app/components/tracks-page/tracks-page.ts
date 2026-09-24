import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import {
  formatAudioType,
  formatSize,
  validateAudioFile,
} from '../../shared/audio-constraints';

/** Tailles de page proposées : le backend refuse tout limit supérieur à 20. */
const PAGE_SIZE_OPTIONS = [5, 10, 20];

@Component({
  imports: [ReactiveFormsModule, MatPaginatorModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);
  private readonly destroyRef = inject(DestroyRef);

  // Un input de type file ne se vide pas en remettant un Signal à undefined :
  // il faut remettre à zéro la valeur de l'élément du DOM lui-même.
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // Mission 2 : l'état de la pagination est entièrement décrit par des Signals.
  // `page` et `limit` sont les paramètres envoyés au serveur, `total` et `pages`
  // viennent de sa réponse : le découpage n'est jamais fait dans Angular.
  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly limit = signal(PAGE_SIZE_OPTIONS[0]);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');

  // Mission 3 : états de l'envoi. `uploading` sert à la fois à afficher le
  // chargement et à bloquer une seconde soumission.
  readonly title = new FormControl('', { nonNullable: true });
  readonly selectedFile = signal<File | undefined>(undefined);
  readonly fileError = signal('');
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');

  // Mission 3 : états de la lecture.
  readonly audioUrl = signal('');
  readonly currentTrack = signal<Track | null>(null);
  readonly loadingAudioId = signal<string | null>(null);
  readonly audioError = signal('');

  readonly formatSize = formatSize;
  readonly formatAudioType = formatAudioType;

  constructor() {
    this.load();

    // La dernière ObjectURL créée n'est révoquée par aucun play() suivant :
    // c'est la destruction du composant qui doit libérer le Blob retenu en
    // mémoire par le navigateur, sinon il y reste jusqu'au rechargement complet.
    this.destroyRef.onDestroy(() => this.releaseAudioUrl());
  }

  /** Formate une date ISO renvoyée par l'API en date lisible en français. */
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Demande au serveur la page courante. Chaque appel produit une requête
   * `GET /api/tracks?page=...&limit=...` : c'est le serveur qui découpe.
   */
  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        // Le backend borne page et limit (limit <= 20, page >= 1) : on réaligne
        // l'état local sur ce que le serveur a réellement appliqué.
        this.page.set(response.page);
        this.limit.set(response.limit);
        this.total.set(response.total);
        this.pages.set(response.pages);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Chargement impossible', error);
        this.tracks.set([]);
        this.error.set(error.error?.message ?? 'Impossible de charger la bibliothèque.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Le Paginator Material est indexé à partir de 0 (`pageIndex`) alors que
   * l'API compte à partir de 1 (`page`) : la conversion se fait ici.
   */
  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.limit.set(event.pageSize);
    this.load();
  }

  /**
   * Sélection d'un fichier : les mêmes règles que le backend sont vérifiées
   * tout de suite, pour prévenir l'utilisateur sans envoyer 25 Mo pour rien.
   */
  choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    console.debug('[TracksPage] Fichier sélectionné', file?.name);

    this.uploadError.set('');
    this.uploadSuccess.set('');

    const problem = file ? validateAudioFile(file) : null;
    this.fileError.set(problem ?? '');
    // Un fichier refusé n'est pas conservé : le bouton Envoyer reste inactif.
    this.selectedFile.set(problem ? undefined : file);
  }

  /** Envoie le fichier sélectionné, en bloquant toute seconde soumission. */
  upload(): void {
    const file = this.selectedFile();

    // Double protection : le bouton est déjà désactivé dans le template, mais un
    // double clic rapide ou un appel programmatique ne doit pas passer non plus.
    if (!file || this.uploading()) return;

    const problem = validateAudioFile(file);
    if (problem) {
      this.fileError.set(problem);
      return;
    }

    const submittedTitle = this.title.value || file.name;

    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    // Le champ titre appartient au formulaire réactif : on le désactive par son
    // API pour qu'il ne soit pas modifié pendant que l'envoi est en cours.
    this.title.disable();

    this.service.upload(file, submittedTitle).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.uploading.set(false);
        this.title.enable();
        this.uploadSuccess.set(`« ${track.title} » a été ajouté à votre bibliothèque.`);
        this.resetUploadForm();
        // Les pistes sont triées par date décroissante : la nouvelle est en
        // première page, on y revient donc pour la rendre visible.
        this.page.set(1);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.title.enable();
        // Le message vient du backend (Format audio non accepté, Fichier audio
        // requis, File too large…) quand il en fournit un.
        this.uploadError.set(error.error?.message ?? "L'envoi a échoué. Réessayez.");
      },
    });
  }

  /** Télécharge le Blob authentifié puis le branche sur le lecteur `<audio>`. */
  play(track: Track): void {
    this.audioError.set('');
    this.loadingAudioId.set(track.id);

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        this.loadingAudioId.set(null);
        // L'ancienne URL est révoquée avant d'en créer une nouvelle : sans cela
        // chaque écoute laisserait un Blob complet en mémoire.
        this.releaseAudioUrl();
        this.audioUrl.set(URL.createObjectURL(blob));
        this.currentTrack.set(track);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Lecture impossible', error);
        this.loadingAudioId.set(null);
        this.audioError.set(
          error.status === 404
            ? "Cette piste n'existe plus ou ne vous appartient pas."
            : 'Lecture impossible pour le moment.',
        );
      },
    });
  }

  /** Erreur signalée par l'élément `<audio>` lui-même (flux illisible). */
  onAudioError(): void {
    console.error('[TracksPage] Le lecteur audio a rejeté le flux');
    this.audioError.set('Le navigateur ne parvient pas à lire ce fichier audio.');
  }

  private resetUploadForm(): void {
    this.title.setValue('');
    this.selectedFile.set(undefined);
    this.fileError.set('');

    const input = this.fileInput();
    if (input) input.nativeElement.value = '';
  }

  private releaseAudioUrl(): void {
    const previousUrl = this.audioUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      console.debug('[TracksPage] ObjectURL révoquée');
    }
  }
}
