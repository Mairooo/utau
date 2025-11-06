import { Component, OnInit, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Api } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { User } from '../../shared/interfaces/user.interface';

// Les réponses Directus utilisent généralement la forme { data: T }
type DirectusItemResponse<T> = { data: T };

type DirectusListResponse<T> = { data: T[]; meta?: { total_count?: number } };

type ProjectItem = {
  id: string;
  title: string;
  description?: string | null;
  cover_image?: string | { id: string } | null;
  status?: string;
  likes_count?: number;
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
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly DIRECTUS_URL: string = environment.directusUrl;

  user?: User;
  avatarUrl?: string;
  projectCount = 0;
  private userId: string | null = null;
  projects: ProjectViewModel[] = [];
  errorMessage: string | null = null;

  constructor() {
    // afterNextRender doit être appelé dans un contexte d'injection (ex: constructeur)
    afterNextRender(async () => {
      await this.loadUser();
      
      if (!this.userId) {
        // Token invalide/expiré ou /users/me a échoué: renvoyer vers login
        await this.router.navigate(['/login']);
        return;
      }
      
      await this.loadProjectCount();
      await this.loadProjects();
      this.cdr.detectChanges();
    });
  }

  async ngOnInit(): Promise<void> {
    // Le chargement est déclenché dans le constructeur via afterNextRender
  }

  private async loadUser(): Promise<void> {
    try {
      const token = this.auth.accessToken;
      if (!token) return;
      const res = await this.api.getMe(token).toPromise();
      const u = (res as DirectusItemResponse<User & { description?: string; avatar?: string | { id: string } | null }> | undefined)?.data;
      if (!u) return;

      this.user = u as User;
      this.userId = u.id;
      const avatarId = typeof u.avatar === 'string' ? u.avatar : (u.avatar && typeof u.avatar === 'object' ? (u.avatar as any).id : undefined);
      this.avatarUrl = avatarId ? `${this.DIRECTUS_URL}/assets/${avatarId}?width=160&height=160&fit=cover&quality=80` : undefined;
    } catch (error) {
      console.error('Erreur lors du chargement de l\'utilisateur:', error);
    }
  }

  private async loadProjectCount(): Promise<void> {
    try {
      if (!this.userId) return;
  const resp = await this.api.countUserProjects(this.userId).toPromise();
  this.projectCount = resp?.meta?.total_count ?? 0;
  } catch {}
  }

  private async loadProjects(): Promise<void> {
    try {
      if (!this.userId) return;
      const fields = ['id','title','description','cover_image','status','likes_count','plays'];
      const resp = await this.api.getUserProjects(this.userId, fields).toPromise();
      const items = (resp?.data ?? []) as unknown as ProjectItem[];
      this.projects = items.map((p) => {
        const coverId = typeof p.cover_image === 'string' ? p.cover_image : (p.cover_image && typeof p.cover_image === 'object' ? p.cover_image.id : undefined);
        const coverImageUrl = coverId ? `${this.DIRECTUS_URL}/assets/${coverId}?width=480&height=270&fit=cover&quality=80&format=webp` : undefined;
        return {
          id: p.id,
          title: p.title,
          coverImageUrl,
          status: p.status,
          likes: p.likes_count || 0,
          plays: p.plays
        } as ProjectViewModel;
      });
    } catch (error: any) {
      this.errorMessage = 'Erreur lors du chargement des projets.';
    }
  }
}


