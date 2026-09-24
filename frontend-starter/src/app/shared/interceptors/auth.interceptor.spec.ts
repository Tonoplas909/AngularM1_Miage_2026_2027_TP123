import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

/*
 * Un test d'intercepteur vérifie une transformation : la requête qui sort du
 * service n'est pas celle qui part sur le réseau. On envoie donc une requête
 * réelle à travers la chaîne d'intercepteurs et on inspecte ce qui arrive au
 * transport (ici simulé), et non ce que le service a demandé.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it("ajoute l'en-tête Authorization quand un token existe", () => {
    auth.token.set('jeton-de-test');

    http.get('/api/tracks').subscribe();

    const request = httpTesting.expectOne('/api/tracks');

    expect(request.request.headers.get('Authorization')).toBe('Bearer jeton-de-test');

    request.flush({});
  });

  it("n'ajoute aucun en-tête Authorization en absence de token", () => {
    auth.token.set(null);

    http.post('/api/auth/login', { email: 'a@b.c', password: 'secret' }).subscribe();

    const request = httpTesting.expectOne('/api/auth/login');

    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({});
  });

  it('utilise le token courant et non celui capturé au démarrage', () => {
    auth.token.set('ancien-jeton');
    auth.token.set('nouveau-jeton');

    http.get('/api/users/me').subscribe();

    const request = httpTesting.expectOne('/api/users/me');

    expect(request.request.headers.get('Authorization')).toBe('Bearer nouveau-jeton');

    request.flush({});
  });
});
