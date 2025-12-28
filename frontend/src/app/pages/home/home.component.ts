import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../shared/services/project.service';
import { Projects } from '../../shared/interfaces/project.interface';
import { environment } from '../../../environments/environment';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { LikeButtonComponent } from '../../shared/components/like-button/like-button.component';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { WebSocketService } from '../../shared/services/websocket.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchBarComponent, LikeButtonComponent, NotificationBellComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  isLoggedIn = !!localStorage.getItem('directus_access_token');
  private readonly DIRECTUS_URL: string = environment.directusUrl;
  private wsSubscriptions: Subscription[] = [];

  // ViewModel incluant l'URL d'image de couverture
  projets: (Projects & { coverImageUrl?: string })[] = [];
  loading = true;
  error: string | null = null;

  totalProjects = 0;
  totalLikes = 0;
  totalPlays = 0;
  totalCreators = 0;

  constructor(
    private router: Router,
    private projectService: ProjectsService,
    private cd: ChangeDetectorRef,
    private wsService: WebSocketService
  ) {}

  ngOnInit() {
    this.loadProjects();
    
    // Connecter au WebSocket seulement si l'utilisateur est connecté
    if (this.isLoggedIn) {
      this.wsService.connect();
      this.wsService.subscribe('Projects');
      this.wsService.subscribe('Likes');

      // Écouter les changements de projets en temps réel
      this.wsSubscriptions.push(
        this.wsService.onCollection('Projects').subscribe((msg) => {
          console.log('📨 Projet changé:', msg.event);
          this.refreshStats();
        })
      );

      // Écouter les changements de likes en temps réel
      this.wsSubscriptions.push(
        this.wsService.onCollection('Likes').subscribe((msg) => {
          console.log('❤️ Like changé:', msg.event);
          this.refreshStats();
        })
      );
    }
  }

  ngOnDestroy() {
    // Nettoyer les subscriptions
    this.wsSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.isLoggedIn) {
      this.wsService.unsubscribe('Projects');
      this.wsService.unsubscribe('Likes');
    }
  }

  private loadProjects() {
    this.projectService.getprojects().subscribe({
      next: (response) => {
        // Filtrer uniquement les projets publiés
        const published = response.data.filter(p => Number(p.status) === 1);

        // Construire l'URL d'image de couverture (Directus assets)
        this.projets = published.map((p) => {
          const coverId = typeof (p as any).cover_image === 'string'
            ? (p as any).cover_image
            : (p as any).cover_image && typeof (p as any).cover_image === 'object'
              ? (p as any).cover_image.id
              : undefined;
          const coverImageUrl = coverId
            ? `${this.DIRECTUS_URL}/assets/${coverId}?width=640&height=384&fit=cover&quality=80&format=webp`
            : undefined;
          return { ...p, coverImageUrl } as Projects & { coverImageUrl?: string };
        });

        this.updateStats();
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des projets';
        this.loading = false;
      },
    });
  }

  private refreshStats() {
    this.projectService.getprojects().subscribe({
      next: (response) => {
        // Filtrer uniquement les projets publiés
        const published = response.data.filter(p => Number(p.status) === 1);

        // Mettre à jour les projets existants sans recréer le tableau (évite le clignotement)
        published.forEach((p) => {
          const existingIndex = this.projets.findIndex(proj => proj.id === p.id);
          if (existingIndex !== -1) {
            // Mettre à jour seulement les propriétés qui changent
            this.projets[existingIndex].likes_count = p.likes_count;
            this.projets[existingIndex].plays = p.plays;
            this.projets[existingIndex].status = p.status;
          } else {
            // Nouveau projet, l'ajouter
            const coverId = typeof (p as any).cover_image === 'string'
              ? (p as any).cover_image
              : (p as any).cover_image && typeof (p as any).cover_image === 'object'
                ? (p as any).cover_image.id
                : undefined;
            const coverImageUrl = coverId
              ? `${this.DIRECTUS_URL}/assets/${coverId}?width=640&height=384&fit=cover&quality=80&format=webp`
              : undefined;
            this.projets.push({ ...p, coverImageUrl } as Projects & { coverImageUrl?: string });
          }
        });

        // Supprimer les projets qui n'existent plus
        this.projets = this.projets.filter(proj => 
          published.some(p => p.id === proj.id)
        );

        this.updateStats();
        this.cd.detectChanges();
      },
      error: () => {
        // Ignorer les erreurs lors du refresh silencieux
      },
    });
  }

  trackByProjectId(index: number, projet: Projects): string {
    return projet.id;
  }

  private updateStats() {
    // Stats
    this.totalProjects = this.projets.length;
    this.totalLikes = this.projets.reduce((acc, p) => acc + (p.likes_count ?? 0), 0);
    this.totalPlays = this.projets.reduce((acc, p) => acc + (p.plays ?? 0), 0);

    // Créateurs distincts ayant au moins 1 projet publié
    const creators = new Set<string>();
    this.projets.forEach(p => {
      if (p.user_created) {
        if (typeof p.user_created === 'object') {
          const userId = (p.user_created as any).id;
          if (userId) creators.add(userId);
        } else if (typeof p.user_created === 'string') {
          creators.add(p.user_created);
        }
      }
    });
    this.totalCreators = creators.size;
  }

  onLogout() {
    localStorage.removeItem('directus_access_token');
    this.isLoggedIn = false;
  this.router.navigate(['/login']);
  }

  goToCreateProjects() {
    const token = localStorage.getItem('directus_access_token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/project']);
  }

  goToProject(title: string) {
    this.router.navigate(['/project', title]);
  }

  goToLogin() {
  this.router.navigate(['/login']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  /**
   * Récupérer le nom du créateur d'un projet
   */
  getCreatorName(projet: Projects): string | null {
    if (!projet.user_created) return null;
    
    // Si user_created est un objet avec first_name et/ou last_name
    if (typeof projet.user_created === 'object') {
      const user = projet.user_created as any;
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Si on a un nom complet, le retourner
      if (fullName) return fullName;
      
      // Sinon, utiliser l'email s'il existe
      if (user.email) {
        return user.email.split('@')[0]; // Prendre la partie avant le @
      }
    }
    
    // Si c'est juste un ID string
    if (typeof projet.user_created === 'string') {
      return `Utilisateur ${projet.user_created.substring(0, 8)}`;
    }
    
    return null;
  }
}
