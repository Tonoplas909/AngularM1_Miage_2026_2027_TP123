import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_ROUTES = ['/auth/login', '/auth/register'];

/** Logs out and redirects to /login when a protected request is rejected with 401. */
export const authErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some((route) => request.url.includes(route));

      if (error.status === 401 && !isPublicAuthRoute) {
        console.warn('[authErrorInterceptor] 401 reçu, déconnexion', request.url);
        auth.logout();
        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    }),
  );
};
