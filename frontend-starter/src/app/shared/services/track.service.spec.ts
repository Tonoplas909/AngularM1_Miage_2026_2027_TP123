import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpEvent, HttpEventType, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Track } from '../models/track.model';
import { TrackService } from './track.service';

const TRACK: Track = {
  id: 'abc123',
  title: 'Blues en La',
  originalName: 'blues.mp3',
  mimeType: 'audio/mpeg',
  size: 2048,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('TrackService', () => {
  let service: TrackService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TrackService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('list() transmet réellement page et limit dans la query string', () => {
    service.list(3, 10).subscribe();

    // On filtre sur le chemin seul : les paramètres sont inspectés ensuite.
    const request = httpTesting.expectOne(
      (candidate) => candidate.url === '/api/tracks',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('limit')).toBe('10');
    // L'URL complète effectivement envoyée, telle qu'elle apparaît dans Network.
    expect(request.request.urlWithParams).toBe('/api/tracks?page=3&limit=10');

    request.flush({ items: [TRACK], page: 3, limit: 10, total: 25, pages: 3 });
  });

  it('list() utilise page=1 et limit=5 par défaut', () => {
    service.list().subscribe();

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === '/api/tracks',
    );

    expect(request.request.urlWithParams).toBe('/api/tracks?page=1&limit=5');

    request.flush({ items: [], page: 1, limit: 5, total: 0, pages: 1 });
  });

  it('upload() envoie un FormData contenant exactement audio et title', () => {
    const file = new File(['contenu-audio'], 'blues.mp3', { type: 'audio/mpeg' });

    service.upload(file, 'Blues en La').subscribe();

    const request = httpTesting.expectOne('/api/tracks');
    const body = request.request.body as FormData;

    expect(request.request.method).toBe('POST');
    expect(body instanceof FormData).toBe(true);
    expect(body.get('title')).toBe('Blues en La');
    expect((body.get('audio') as File).name).toBe('blues.mp3');
    // Les champs multipart attendus par le backend, et rien d'autre.
    expect([...body.keys()].sort()).toEqual(['audio', 'title']);
    // Content-Type volontairement absent : le navigateur doit le générer
    // lui-même avec la boundary du multipart.
    expect(request.request.headers.has('Content-Type')).toBe(false);
    expect(request.request.reportProgress).toBe(true);

    request.flush(TRACK);
  });

  it('upload() émet les événements de progression puis la réponse', () => {
    const file = new File(['contenu-audio'], 'blues.mp3', { type: 'audio/mpeg' });
    const received: HttpEvent<Track>[] = [];

    service.upload(file, 'Blues en La').subscribe((event) => received.push(event));

    const request = httpTesting.expectOne('/api/tracks');

    // Le faux transport rejoue une progression d'upload, comme le navigateur.
    request.event({ type: HttpEventType.UploadProgress, loaded: 512, total: 1024 });
    request.flush(TRACK);

    const progress = received.find(
      (event) => event.type === HttpEventType.UploadProgress,
    );
    const response = received.find((event) => event.type === HttpEventType.Response);

    expect(progress).toBeDefined();
    expect(response).toBeDefined();
    // Un appel classique n'émettrait qu'une seule valeur : ici il y en a
    // plusieurs, c'est tout l'intérêt de observe: 'events'.
    expect(received.length).toBeGreaterThan(1);
  });

  it('remove() appelle DELETE /api/tracks/:id', () => {
    service.remove('abc123').subscribe();

    const request = httpTesting.expectOne('/api/tracks/abc123');

    expect(request.request.method).toBe('DELETE');

    // Le backend répond 204 sans corps.
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('audio() demande un Blob sur la route protégée de la piste', () => {
    service.audio('abc123').subscribe();

    const request = httpTesting.expectOne('/api/tracks/abc123/audio');

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');

    request.flush(new Blob(['octets'], { type: 'audio/mpeg' }));
  });
});
