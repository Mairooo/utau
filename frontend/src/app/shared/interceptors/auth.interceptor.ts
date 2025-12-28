import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

const ACCESS_TOKEN_KEY = 'directus_access_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  const token = isBrowser ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  
  // Si pas de token, on laisse passer sans redirection (accès public)
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 || err.status === 403) {
        if (isBrowser) localStorage.removeItem(ACCESS_TOKEN_KEY);
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};


