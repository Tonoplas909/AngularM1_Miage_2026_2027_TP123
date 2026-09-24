import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 5) {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  /**
   * Envoie le fichier en multipart/form-data avec exactement les deux champs
   * attendus par le backend : `audio` (le fichier) et `title` (le texte).
   *
   * TP3 Mission 6 : `observe: 'events'` change la nature de l'Observable. Au
   * lieu d'émettre une seule fois la réponse finale, il émet toute la suite
   * d'événements de la requête (Sent, UploadProgress…, Response). C'est
   * `reportProgress: true` qui demande à Angular de produire les événements
   * de progression ; sans lui, seul le début et la fin seraient visibles.
   *
   * Aucun `Content-Type` n'est posé à la main : le navigateur doit le générer
   * lui-même, car il doit y ajouter la « boundary » qui sépare les parties.
   */
  upload(file: File, title: string) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  /**
   * Supprime une piste. Le backend répond `204 No Content` : il n'y a donc pas
   * de corps à typer. Il répond `404` si la piste n'existe plus OU si elle
   * appartient à quelqu'un d'autre — c'est lui, et non le guard Angular, qui
   * vérifie réellement le propriétaire.
   */
  remove(id: string) {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}
