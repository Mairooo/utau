import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { HttpClient } from '@angular/common/http';

interface ProjectItem {
  id: string;
  title: string;
  description?: string;
  likes?: number;
  plays?: number;
  cover_image?: string | { id: string } | null;
  user_created?: { first_name?: string; last_name?: string; email?: string } | string | null;
}

interface DirectusListResponse<T> {
  data: T[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  private readonly DIRECTUS_URL: string = (globalThis as any).DIRECTUS_URL || 'http://localhost:8055';

  projects: Array<{ title: string; author: string; badge?: string; likes: number; plays: number; imageUrl?: string }> = [];

  async ngOnInit(): Promise<void> {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
      await this.loadProjects();
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const url = `${this.DIRECTUS_URL}/items/Projects?fields=id,title,likes,plays,cover_image`;
      const response = await this.http.get<DirectusListResponse<ProjectItem>>(url).toPromise();
      const items = response?.data ?? [];
      this.projects = items.map((item) => {
        const author = 'Inconnu';
        let imageUrl: string | undefined;
        const cover = item.cover_image;
        const coverId = typeof cover === 'string' ? cover : (cover && typeof cover === 'object' ? cover.id : undefined);
        if (coverId) imageUrl = `${this.DIRECTUS_URL}/assets/${coverId}`;
        return {
          title: item.title ?? 'Sans titre',
          author,
          likes: item.likes ?? 0,
          plays: item.plays ?? 0,
          imageUrl,
        };
      });
    } catch (error: any) {
      if (error?.status === 401 || error?.status === 403) {
        console.warn('Accès refusé, connexion requise.');
      }
      console.error('Failed to load projects', error);
      this.projects = [];
    }
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
  }
}


