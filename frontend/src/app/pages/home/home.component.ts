import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProjectsService } from '../../shared/services/project.service';
import { Projects } from '../../shared/interfaces/project.interface';
import { environment } from '../../../environments/environment';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { LikeButtonComponent } from '../../shared/components/like-button/like-button.component';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchBarComponent, LikeButtonComponent, NotificationBellComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  isLoggedIn = !!localStorage.getItem('directus_access_token');
  private readonly DIRECTUS_URL: string = environment.directusUrl;

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
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
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

        this.loading = false;
        this.cd.detectChanges(); // ⚡ Force l'affichage
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des projets';
        this.loading = false;
      },
    });
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
