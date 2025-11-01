import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProjectsService } from '../../shared/services/project.service';
import { Projects } from '../../shared/interfaces/project.interface';
import { environment } from '../../../environments/environment';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, SearchBarComponent],
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
        this.totalLikes = this.projets.reduce((acc, p) => acc + (p.likes ?? 0), 0);
        this.totalPlays = this.projets.reduce((acc, p) => acc + (p.plays ?? 0), 0);

        // Créateurs distincts
        const creators = new Set<string>();
        this.projets.forEach(p => {
          if (p.user_created && typeof p.user_created === 'object') {
            const name = `${p.user_created.first_name ?? ''} ${p.user_created.last_name ?? ''}`.trim();
            if (name) creators.add(name);
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
    this.router.navigate(['/project-view', title]);
  }

  goToLogin() {
  this.router.navigate(['/login']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }
}
