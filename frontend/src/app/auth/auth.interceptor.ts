import { HttpInterceptorFn } from '@angular/common/http';

const ACCESS_TOKEN_KEY = 'directus_access_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  const token = isBrowser ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (!token) return next(req);

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
  return next(authReq);
};


