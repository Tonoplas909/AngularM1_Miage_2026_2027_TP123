import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Page } from '../../shared/models/page.model';
import { Track } from '../../shared/models/track.model';
import { TracksPageComponent } from './tracks-page';

const TRACK: Track = {
  id: 'abc123',
  title: 'Blues en La',
  originalName: 'blues.mp3',
  mimeType: 'audio/mpeg',
  size: 2048,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function page(items: Track[], overrides: Partial<Page<Track>> = {}): Page<Track> {
  return {
    items,
    page: 1,
    limit: 5,
    total: items.length,
    pages: 1,
    ...overrides,
  };
}

/** Fabrique un faux événement de sélection de fichier, sans DataTransfer. */
function fileEvent(file: File): Event {
  return { target: { files: [file] } } as unknown as Event;
}

describe('TracksPageComponent', () => {
  let fixture: ComponentFixture<TracksPageComponent>;
  let component: TracksPageComponent;
  let httpTesting: HttpTestingController;
  const snackBar = { open: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    snackBar.open.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Le SnackBar est remplacé par un double : le test vérifie qu'il est
        // appelé avec le bon message, sans dépendre de son rendu.
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });

    fixture = TestBed.createComponent(TracksPageComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  /** Consomme la requête déclenchée par le constructeur du composant. */
  function flushInitialLoad(items: Track[] = [TRACK], overrides: Partial<Page<Track>> = {}) {
    const request = httpTesting.expectOne((r) => r.url === '/api/tracks');
    request.flush(page(items, overrides));
    fixture.detectChanges();
    return request;
  }

  it('charge la première page au démarrage avec page=1 et limit=5', () => {
    const request = httpTesting.expectOne((r) => r.url === '/api/tracks');

    expect(request.request.urlWithParams).toBe('/api/tracks?page=1&limit=5');

    request.flush(page([TRACK], { total: 12, pages: 3 }));
    fixture.detectChanges();

    expect(component.tracks().length).toBe(1);
    expect(component.total()).toBe(12);
    expect(component.pages()).toBe(3);
    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Blues en La');
  });

  it('affiche un message d’erreur après un échec HTTP du chargement', () => {
    const request = httpTesting.expectOne((r) => r.url === '/api/tracks');

    request.flush({ message: 'Panne serveur' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.error()).toBe('Panne serveur');
    expect(component.tracks()).toEqual([]);
    expect(component.loading()).toBe(false);
    // Le message est réellement rendu, dans un conteneur annoncé aux lecteurs
    // d'écran (role="alert").
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Panne serveur');
  });

  it('change de page en refaisant une requête avec le nouveau page', () => {
    flushInitialLoad([TRACK], { total: 12, pages: 3 });

    // pageIndex 1 (Material, base 0) doit devenir page=2 (API, base 1).
    component.onPageChange({ pageIndex: 1, pageSize: 5, length: 12 });

    const second = httpTesting.expectOne((r) => r.url === '/api/tracks');

    expect(second.request.urlWithParams).toBe('/api/tracks?page=2&limit=5');

    second.flush(page([TRACK], { page: 2, total: 12, pages: 3 }));
  });

  it('refuse un fichier trop volumineux sans envoyer aucune requête', () => {
    flushInitialLoad();

    // 26 Mo : au-dessus de la limite de 25 Mo appliquée par le backend.
    const big = new File([new Uint8Array(26 * 1024 * 1024)], 'long.mp3', {
      type: 'audio/mpeg',
    });
    component.choose(fileEvent(big));

    expect(component.fileError()).toContain('trop volumineux');
    expect(component.selectedFile()).toBeUndefined();

    component.upload();

    // Aucune requête POST : la validation a coupé avant l'appel HTTP.
    httpTesting.expectNone('/api/tracks');
  });

  it('refuse un format non audio sans envoyer aucune requête', () => {
    flushInitialLoad();

    const wrong = new File(['%PDF'], 'partition.pdf', { type: 'application/pdf' });
    component.choose(fileEvent(wrong));

    expect(component.fileError()).toContain('Format non accepté');

    component.upload();

    httpTesting.expectNone('/api/tracks');
  });

  it('met à jour la progression puis l’état de succès pendant un upload', () => {
    flushInitialLoad([]);

    const file = new File(['audio'], 'blues.mp3', { type: 'audio/mpeg' });
    component.choose(fileEvent(file));
    component.title.setValue('Blues en La');
    component.upload();

    expect(component.uploadState()).toBe('uploading');

    const upload = httpTesting.expectOne('/api/tracks');

    expect((upload.request.body as FormData).get('title')).toBe('Blues en La');

    upload.event({ type: HttpEventType.UploadProgress, loaded: 512, total: 1024 });
    fixture.detectChanges();

    expect(component.uploadProgress()).toBe(50);
    expect(component.uploadState()).toBe('uploading');

    upload.flush(TRACK);
    fixture.detectChanges();

    expect(component.uploadState()).toBe('success');
    expect(component.uploadProgress()).toBe(100);
    // Formulaire vidé et retour en première page.
    expect(component.title.value).toBe('');
    expect(component.selectedFile()).toBeUndefined();
    expect(component.page()).toBe(1);

    // Le succès déclenche un rechargement de la liste.
    httpTesting.expectOne((r) => r.url === '/api/tracks').flush(page([TRACK]));
  });

  it('passe en état d’erreur et affiche le message du serveur si l’upload échoue', () => {
    flushInitialLoad([]);

    const file = new File(['audio'], 'blues.mp3', { type: 'audio/mpeg' });
    component.choose(fileEvent(file));
    component.upload();

    httpTesting
      .expectOne('/api/tracks')
      .flush({ message: 'Format audio non accepté' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(component.uploadState()).toBe('error');
    expect(component.uploadError()).toBe('Format audio non accepté');
    expect(component.uploadProgress()).toBeNull();
    // Le champ titre a bien été réactivé après l'échec.
    expect(component.title.disabled).toBe(false);
  });

  it('bloque une seconde soumission pendant un upload en cours', () => {
    flushInitialLoad([]);

    const file = new File(['audio'], 'blues.mp3', { type: 'audio/mpeg' });
    component.choose(fileEvent(file));
    component.upload();
    // Deuxième clic immédiat : il ne doit produire aucune requête de plus.
    component.upload();

    const requests = httpTesting.match('/api/tracks');

    expect(requests.length).toBe(1);

    requests[0].flush(TRACK);
    httpTesting.expectOne((r) => r.url === '/api/tracks').flush(page([TRACK]));
  });

  it('la suppression confirmée appelle DELETE /api/tracks/:id puis recharge la liste', () => {
    flushInitialLoad([TRACK]);

    component.askDelete(TRACK);
    fixture.detectChanges();

    expect(component.confirmingDeleteId()).toBe('abc123');

    component.confirmDelete(TRACK);

    const remove = httpTesting.expectOne('/api/tracks/abc123');

    expect(remove.request.method).toBe('DELETE');

    remove.flush(null, { status: 204, statusText: 'No Content' });

    // Rechargement immédiat : l'écran ne doit pas garder la piste supprimée.
    const reload = httpTesting.expectOne((r) => r.url === '/api/tracks');
    reload.flush(page([]));
    fixture.detectChanges();

    expect(component.tracks()).toEqual([]);
    expect(component.deletingId()).toBeNull();
    expect(component.confirmingDeleteId()).toBeNull();
    expect(snackBar.open).toHaveBeenCalled();
    expect(snackBar.open.mock.calls[0][0]).toContain('supprimé');
  });

  it('un 404 à la suppression informe l’utilisateur et resynchronise l’écran', () => {
    flushInitialLoad([TRACK]);

    component.askDelete(TRACK);
    component.confirmDelete(TRACK);

    httpTesting
      .expectOne('/api/tracks/abc123')
      .flush({ message: 'Piste inconnue' }, { status: 404, statusText: 'Not Found' });

    expect(snackBar.open.mock.calls[0][0]).toContain("n'existe plus");

    // Même en erreur 404, la liste est redemandée : l'affichage était périmé.
    httpTesting.expectOne((r) => r.url === '/api/tracks').flush(page([]));

    expect(component.deletingId()).toBeNull();
  });

  it('bloque un second clic pendant une suppression en cours', () => {
    flushInitialLoad([TRACK]);

    component.confirmDelete(TRACK);
    component.confirmDelete(TRACK);

    const requests = httpTesting.match('/api/tracks/abc123');

    expect(requests.length).toBe(1);

    requests[0].flush(null, { status: 204, statusText: 'No Content' });
    httpTesting.expectOne((r) => r.url === '/api/tracks').flush(page([]));
  });

  it('la lecture récupère un Blob et publie une ObjectURL révoquée ensuite', () => {
    flushInitialLoad([TRACK]);

    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:fausse-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    component.play(TRACK);

    const audio = httpTesting.expectOne('/api/tracks/abc123/audio');

    expect(audio.request.responseType).toBe('blob');

    audio.flush(new Blob(['octets'], { type: 'audio/mpeg' }));
    fixture.detectChanges();

    expect(createSpy).toHaveBeenCalled();
    expect(component.audioUrl()).toBe('blob:fausse-url');
    expect(component.currentTrack()?.id).toBe('abc123');

    // La destruction du composant doit libérer la dernière ObjectURL.
    fixture.destroy();

    expect(revokeSpy).toHaveBeenCalledWith('blob:fausse-url');

    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('affiche une erreur compréhensible si la lecture est refusée', () => {
    flushInitialLoad([TRACK]);

    component.play(TRACK);

    // La requête attend un Blob : son corps d'erreur doit en être un aussi,
    // exactement comme ce que le navigateur reçoit réellement.
    httpTesting.expectOne('/api/tracks/abc123/audio').flush(
      new Blob([JSON.stringify({ message: 'Piste inconnue' })], {
        type: 'application/json',
      }),
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(component.audioError()).toContain("n'existe plus");
    expect(component.loadingAudioId()).toBeNull();
  });
});
