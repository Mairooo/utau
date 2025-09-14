import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [() => import('./auth/auth.guard').then(m => m.authGuard)],
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'profile',
    canActivate: [() => import('./auth/auth.guard').then(m => m.authGuard)],
    loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent)
  },
  {
    path: 'settings',
    canActivate: [() => import('./auth/auth.guard').then(m => m.authGuard)],
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'composer',
    canActivate: [() => import('./auth/auth.guard').then(m => m.authGuard)],
    loadComponent: () => import('./composer/composer.component').then(m => m.ComposerComponent)
  },
  { path: '**', redirectTo: '' }
];
