import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';

/*
 * Ces tests n'ont besoin ni du backend ni de MongoDB : provideHttpClientTesting
 * remplace le transport HTTP réel par un faux transport que le test pilote.
 * On vérifie donc le contrat côté client (URL, méthode, corps, en-têtes) et la
 * façon dont le service réagit à une réponse simulée.
 */
describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Échoue si une requête attendue n'a pas été consommée par le test.
    httpTesting.verify();
    localStorage.clear();
  });

  it('login() appelle POST /api/auth/login avec email et mot de passe', () => {
    service.login('demo@example.com', 'Demo1234!').subscribe();

    const request = httpTesting.expectOne('/api/auth/login');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'demo@example.com',
      password: 'Demo1234!',
    });

    request.flush({
      token: 'jeton-de-test',
      user: {
        id: '1',
        name: 'Demo',
        email: 'demo@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('login() mémorise le token dans le Signal et dans localStorage', () => {
    service.login('demo@example.com', 'Demo1234!').subscribe();

    httpTesting.expectOne('/api/auth/login').flush({
      token: 'jeton-de-test',
      user: {
        id: '1',
        name: 'Demo',
        email: 'demo@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(service.token()).toBe('jeton-de-test');
    expect(service.currentUser()?.name).toBe('Demo');
    expect(localStorage.getItem('gpc_token')).toBe('jeton-de-test');
  });

  it('logout() efface le Signal et le localStorage', () => {
    service.login('demo@example.com', 'Demo1234!').subscribe();
    httpTesting.expectOne('/api/auth/login').flush({
      token: 'jeton-de-test',
      user: {
        id: '1',
        name: 'Demo',
        email: 'demo@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    service.logout();

    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('gpc_token')).toBeNull();
  });
});
