import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

interface ProjectItem {
  id: string;
  title: string;
  description?: string;
  likes?: number;
  plays?: number;
  cover_image?: string | { id: string } | null;
  user_created?: { first_name?: string; last_name?: string; email?: string } | string | null;
  status?: string | number | null;
}

interface DirectusListResponse<T> {
  data: T[];
  meta?: { total_count?: number };
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  private readonly DIRECTUS_URL: string = (globalThis as any).DIRECTUS_URL || 'http://localhost:8055';

  projects: Array<{ title: string; author: string; badge?: string; likes: number; plays: number; imageUrl?: string }> = [];
  totalProjects = 0;
  totalCreators = 0;
  totalLikes = 0;
  totalPlays = 0;

  async ngOnInit(): Promise<void> {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
      await Promise.all([this.loadProjects(), this.loadStats()]);
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const url = `${this.DIRECTUS_URL}/items/Projects?fields=id,title,status,likes,plays,cover_image.id,user_created.first_name,user_created.last_name`;
      const response = await this.http.get<DirectusListResponse<ProjectItem>>(url).toPromise();
      const items = (response?.data ?? []).filter((it) => String(it.status ?? '') === '1');
      this.projects = items.map((item) => {
        let author = 'Inconnu';
        if (item.user_created && typeof item.user_created === 'object') {
          const first = item.user_created.first_name ?? '';
          const last = item.user_created.last_name ?? '';
          const full = `${first} ${last}`.trim();
          if (full) author = full;
        }
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
      // Ensure project count reflects only published items
      this.totalProjects = items.length;
    } catch (error: any) {
      if (error?.status === 401 || error?.status === 403) {
        console.warn('Accès refusé, connexion requise.');
      }
      console.error('Failed to load projects', error);
      this.projects = [];
    }
  }

  private async loadStats(): Promise<void> {
    // Published-only stats
    // Do not overwrite totalProjects if already set from loadProjects
    if (!this.totalProjects) {
      try {
        // Total published projects
        const countUrl = `${this.DIRECTUS_URL}/items/Projects?limit=0&meta=total_count&filter[status][_eq]=1`;
        const countResp = await this.http.get<DirectusListResponse<unknown>>(countUrl).toPromise();
        const total = countResp?.meta?.total_count;
        if (typeof total === 'number') this.totalProjects = total;
      } catch {
      }
    }

    try {
      // Aggregates for published only: sum likes, sum plays, distinct creators
      const aggUrl = `${this.DIRECTUS_URL}/items/Projects?aggregate[sum]=likes&aggregate[sum]=plays&aggregate[countDistinct]=user_created&filter[status][_eq]=1`;
      const aggResp = await this.http.get<{ data: Array<any> }>(aggUrl).toPromise();
      const first = aggResp?.data?.[0] ?? {};
      const sumObj = (first && typeof first.sum === 'object') ? first.sum : {};
      const countDistinct = first?.countDistinct;

      const likesSum = typeof sumObj.likes === 'number' ? sumObj.likes : 0;
      const playsSum = typeof sumObj.plays === 'number' ? sumObj.plays : 0;
      this.totalLikes = likesSum;
      this.totalPlays = playsSum;

      if (typeof countDistinct === 'number') {
        this.totalCreators = countDistinct;
      } else if (countDistinct && typeof countDistinct === 'object') {
        this.totalCreators = typeof countDistinct.user_created === 'number' ? countDistinct.user_created : 0;
      }
    } catch {
      // Fallbacks if aggregates fail: derive from already loaded list (published filtered client-side in loadProjects)
      if (this.projects?.length) {
        this.totalLikes = this.projects.reduce((acc, p) => acc + (p.likes ?? 0), 0);
        this.totalPlays = this.projects.reduce((acc, p) => acc + (p.plays ?? 0), 0);
        if (!this.totalProjects) this.totalProjects = this.projects.length;
      }
    }
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
  }
}


