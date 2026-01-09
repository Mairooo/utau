import { Component, OnInit, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Api } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { User } from '../../shared/interfaces/user.interface';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';

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
  duration?: number;
};

type ProjectViewModel = {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  status?: string;
  likes?: number;
  plays?: number;
  duration?: string;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationBellComponent],
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
  totalLikes = 0;
  private userId: string | null = null;
  projects: ProjectViewModel[] = [];
  likedProjects: ProjectViewModel[] = [];
  errorMessage: string | null = null;
  activeTab: 'projects' | 'liked' = 'projects';

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
      await this.loadLikedProjects(); // Charger les favoris dès le début
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
      const fields = ['id','title','description','cover_image','status','likes_count','plays','duration'];
      const resp = await this.api.getUserProjects(this.userId, fields).toPromise();
      const items = (resp?.data ?? []) as unknown as ProjectItem[];
      this.projects = items.map((p) => {
        const coverId = typeof p.cover_image === 'string' ? p.cover_image : (p.cover_image && typeof p.cover_image === 'object' ? p.cover_image.id : undefined);
        const coverImageUrl = coverId ? `${this.DIRECTUS_URL}/assets/${coverId}?width=480&height=270&fit=cover&quality=80&format=webp` : undefined;
        return {
          id: p.id,
          title: p.title,
          description: p.description || undefined,
          coverImageUrl,
          status: p.status,
          likes: p.likes_count || 0,
          plays: p.plays,
          duration: this.formatDuration(p.duration)
        } as ProjectViewModel;
      });
      
      // Mettre à jour le compteur avec le nombre réel de projets
      this.projectCount = this.projects.length;
      
      // Calculer le total des likes
      this.totalLikes = this.projects.reduce((sum, p) => sum + (p.likes || 0), 0);
    } catch (error: any) {
      this.errorMessage = 'Erreur lors du chargement des projets.';
    }
  }

  editProject(projectId: string): void {
    // Rediriger vers la page d'édition du projet
    this.router.navigate(['/project/edit', projectId]);
  }

  deleteProject(projectId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      const token = this.auth.accessToken;
      if (!token) return;
      
      this.api.deleteProjects(projectId, token).subscribe({
        next: () => {
          // Retirer le projet de la liste
          this.projects = this.projects.filter(p => p.id !== projectId);
          this.projectCount--;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erreur lors de la suppression du projet:', error);
          alert('Erreur lors de la suppression du projet.');
        }
      });
    }
  }

  setActiveTab(tab: 'projects' | 'liked'): void {
    this.activeTab = tab;
  }

  private async loadLikedProjects(): Promise<void> {
    try {
      if (!this.userId) return;
      
      const resp = await this.api.getUserLikedProjects(this.userId).toPromise();
      const items = (resp?.data ?? []) as any[];
      
      this.likedProjects = items
        .filter(like => like.project_id) // Filtrer les likes sans projet
        .map((like: any) => {
          const p = like.project_id;
          const coverId = typeof p.cover_image === 'string' ? p.cover_image : (p.cover_image?.id);
          const coverImageUrl = coverId ? `${this.DIRECTUS_URL}/assets/${coverId}?width=480&height=270&fit=cover&quality=80&format=webp` : undefined;
          
          return {
            id: p.id,
            title: p.title,
            description: p.description || undefined,
            coverImageUrl,
            status: p.status,
            likes: p.likes_count || 0,
            plays: p.plays,
            duration: this.formatDuration(p.duration)
          } as ProjectViewModel;
        });
    } catch (error: any) {
      console.error('Erreur lors du chargement des projets likés:', error);
      this.likedProjects = [];
    }
  }

  onLogout(): void {
    localStorage.removeItem('directus_access_token');
    this.router.navigate(['/login']);
  }

  getFullName(): string {
    if (!this.user) return 'VocaloidFan123';
    const firstName = this.user.first_name || '';
    const lastName = this.user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'VocaloidFan123';
  }

  getUserInitial(): string {
    if (!this.user) return 'V';
    const name = this.getFullName();
    return name.charAt(0).toUpperCase();
  }

  private formatDuration(duration?: number): string {
    if (!duration || duration <= 0) return '0:00';
    
    // La durée peut être en secondes ou en millisecondes, testons
    let totalSeconds = duration;
    
    // Si la valeur est très grande, c'est probablement en millisecondes
    if (duration > 10000) {
      totalSeconds = Math.floor(duration / 1000);
    }
    
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}


