import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

type DirectusLoginResponse = {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
  };
};

type DirectusRegisterResponse = {
  data: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
};

type RegisterData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

import { environment } from '../../../environments/environment';
const DIRECTUS_URL = environment.directusUrl;
const ACCESS_TOKEN_KEY = 'directus_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  get accessToken(): string | null {
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    if (!isBrowser) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  async login(email: string, password: string): Promise<void> {
    const url = `${DIRECTUS_URL}/auth/login`;
    
    try {
      const response = await this.http
        .post<DirectusLoginResponse>(url, { email, password })
        .toPromise();
      
      const tokens = response?.data;
      if (!tokens?.access_token) {
        throw new Error('Aucun token reçu du serveur');
      }

      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
      sessionStorage.clear(); // Nettoyer les sessions de plays
    } catch (error: any) {
      throw new Error(error?.error?.errors?.[0]?.message || error?.message || 'Échec de la connexion');
    }
  }

  async register(data: RegisterData): Promise<DirectusRegisterResponse['data']> {
    // Utiliser l'endpoint /users pour créer un nouvel utilisateur
    const url = `${DIRECTUS_URL}/users`;
    const response = await this.http
      .post<DirectusRegisterResponse>(url, data)
      .toPromise();

    if (!response?.data) {
      throw new Error('Échec de l\'inscription');
    }

    return response.data;
  }

  async logout(): Promise<void> {
    const token = this.accessToken;
    try {
      if (token) {
        await this.http
          .post(`${DIRECTUS_URL}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
          .toPromise();
      }
    } catch {
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.clear(); // Nettoyer les sessions de plays
    await this.router.navigate(['/login']);
  }
}


