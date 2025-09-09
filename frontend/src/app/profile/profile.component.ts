import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

type MeResponse = {
  data: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | { id: string } | null;
    description?: string;
  };
};

type DirectusListResponse<T> = { data: T[]; meta?: { total_count?: number } };

type ProjectItem = {
  id: string;
  title: string;
  description?: string | null;
  cover_image?: string | { id: string } | null;
  status?: string;
  likes?: number;
  plays?: number;
};

type ProjectViewModel = {
  id: string;
  title: string;
  coverImageUrl?: string;
  status?: string;
  likes?: number;
  plays?: number;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly DIRECTUS_URL: string = (globalThis as any).DIRECTUS_URL || 'http://localhost:8055';

  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  description?: string;
  projectCount = 0;
  private userId: string | null = null;
  projects: ProjectViewModel[] = [];

  async ngOnInit(): Promise<void> {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;
    await this.loadUser();
    await this.loadProjectCount();
    await this.loadProjects();
  }

  private async loadUser(): Promise<void> {
    try {
      const url = `${this.DIRECTUS_URL}/users/me?fields=id,first_name,last_name,avatar,description`;
      const res = await this.http.get<MeResponse>(url).toPromise();
      const u = res?.data;
      if (!u) return;
      this.userId = u.id;
      this.firstName = u.first_name ?? undefined;
      this.lastName = u.last_name ?? undefined;
      this.description = u.description ?? undefined;
      const avatarId = typeof u.avatar === 'string' ? u.avatar : (u.avatar && typeof u.avatar === 'object' ? u.avatar.id : undefined);
      this.avatarUrl = avatarId ? `${this.DIRECTUS_URL}/assets/${avatarId}?width=160&height=160&fit=cover&quality=80` : undefined;
    } catch {}
  }

  private async loadProjectCount(): Promise<void> {
    try {
      if (!this.userId) return;
      const url = `${this.DIRECTUS_URL}/items/Projects?limit=0&meta=total_count&filter[user_created][_eq]=${encodeURIComponent(this.userId)}`;
      const resp = await this.http.get<DirectusListResponse<unknown>>(url).toPromise();
      this.projectCount = resp?.meta?.total_count ?? 0;
    } catch {}
  }

  private async loadProjects(): Promise<void> {
    try {
      if (!this.userId) return;
      const fields = [
        'id',
        'title',
        'description',
        'cover_image',
        'status',
        'likes',
        'plays'
      ].join(',');
      const url = `${this.DIRECTUS_URL}/items/Projects?fields=${encodeURIComponent(fields)}&filter[user_created][_eq]=${encodeURIComponent(this.userId)}`;
      const resp = await this.http.get<DirectusListResponse<ProjectItem>>(url).toPromise();
      const items = resp?.data ?? [];
      this.projects = items.map((p) => {
        const coverId = typeof p.cover_image === 'string' ? p.cover_image : (p.cover_image && typeof p.cover_image === 'object' ? p.cover_image.id : undefined);
        const coverImageUrl = coverId ? `${this.DIRECTUS_URL}/assets/${coverId}?width=480&height=270&fit=cover&quality=80&format=webp` : undefined;
        return {
          id: p.id,
          title: p.title,
          coverImageUrl,
          status: p.status,
          likes: p.likes,
          plays: p.plays
        } as ProjectViewModel;
      });
    } catch {}
  }
}


