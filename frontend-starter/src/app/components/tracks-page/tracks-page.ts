import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

/** Tailles de page proposées : le backend refuse tout limit supérieur à 20. */
const PAGE_SIZE_OPTIONS = [5, 10, 20];

@Component({
  imports: [ReactiveFormsModule, MatPaginatorModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);

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

  readonly audioUrl = signal('');
  readonly title = new FormControl('', { nonNullable: true });
  file?: File;

  constructor() {
    this.load();
  }

  choose(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0];
    console.debug('[TracksPage] Fichier sélectionné', this.file?.name);
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

  upload(): void {
    if (!this.file) return;

    this.service.upload(this.file, this.title.value || this.file.name).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.title.setValue('');
        this.file = undefined;
        this.page.set(1);
        this.load();
      },
      error: (error) => console.error('[TracksPage] Envoi impossible', error),
    });
  }

  play(track: Track): void {
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
      },
      error: (error) => console.error('[TracksPage] Lecture impossible', error),
    });
  }
}
