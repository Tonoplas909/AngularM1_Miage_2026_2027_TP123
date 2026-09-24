import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

/*
 * Un guard est une fonction qui rend soit `true`, soit une redirection. Le test
 * l'appelle donc directement, dans un contexte d'injection, et vérifie la valeur
 * rendue — pas besoin de naviguer réellement dans l'application.
 */
describe('authGuard', () => {
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    auth = TestBed.inject(AuthService);
  });

  afterEach(() => localStorage.clear());

  /** `authGuard` n'utilise ni la route ni l'état : des objets vides suffisent. */
  function run() {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('laisse passer un utilisateur porteur d’un token', () => {
    auth.token.set('jeton-de-test');

    expect(run()).toBe(true);
  });

  it('redirige vers /login un utilisateur sans token', () => {
    auth.token.set(null);

    const result = run();
    const router = TestBed.inject(Router);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
