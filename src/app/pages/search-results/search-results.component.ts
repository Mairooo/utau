import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SearchService } from '../../shared/services/search.service';
import { SearchResult, SearchResponse } from '../../shared/interfaces/search.interface';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { LikeButtonComponent } from '../../shared/components/like-button/like-button.component';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { TagService } from '../../shared/services/tag.service';
import { Tag } from '../../shared/interfaces/tag.interface';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchBarComponent, LikeButtonComponent, NotificationBellComponent],
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.css']
})
export class SearchResultsComponent implements OnInit, OnDestroy {
  searchQuery = '';
  results: SearchResult[] = [];
  totalHits = 0;
  isLoading = false;
  processingTime = 0;
  currentPage = 0;
  pageSize = 20;
  sortOption = 'relevance';
  
  // Tags disponibles et sélectionnés
  allTags: Tag[] = [];
  selectedTags: string[] = [];
  
  // État de connexion
  isLoggedIn = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
    private tagService: TagService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.isLoggedIn = !!this.authService.accessToken;
  }

  ngOnInit(): void {
    // Charger tous les tags disponibles
    this.loadTags();
    
    // Écouter les changements de query params
    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(params => {
        this.searchQuery = params['q'] || '';
        this.currentPage = parseInt(params['page'] || '0');
        this.sortOption = params['sort'] || 'relevance';
        
        // Dédupliquer les tags depuis l'URL (éviter les doublons)
        const tagsParam = params['tags'] ? params['tags'].split(',').filter((t: string) => t.trim()) : [];
        this.selectedTags = [...new Set<string>(tagsParam)]; // Utiliser Set pour supprimer les doublons
        
        // Effectuer la recherche si on a des critères (query, tags, ou tri)
        // Note: sortOption 'relevance' avec une query vide lance quand même une recherche pour afficher tous les projets
        if (this.searchQuery || this.selectedTags.length > 0 || this.sortOption !== 'relevance') {
          this.performSearch();
        } else {
          // Aucun critère: afficher tous les projets par défaut (recherche vide)
          this.performSearch();
        }
      });
  }

  /**
   * Charger tous les tags disponibles
   */
  loadTags(): void {
    this.tagService.getAllTags()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.allTags = response.data;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erreur lors du chargement des tags:', error);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Effectuer la recherche
   */
  performSearch(): void {
    // Permettre la recherche même sans query (pour le tri et les tags)
    this.isLoading = true;
    
    const sort = this.sortOption !== 'relevance' ? this.sortOption : undefined;

    this.searchService.searchProjects({
      q: this.searchQuery || '', // Utiliser une chaîne vide si pas de query
      limit: this.pageSize,
      offset: this.currentPage * this.pageSize,
      sort,
      tags: this.selectedTags.length > 0 ? this.selectedTags : undefined
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: SearchResponse) => {
        this.results = response.hits;
        this.totalHits = response.totalHits;
        this.processingTime = response.processingTimeMs;
        this.isLoading = false;
        this.cdr.detectChanges(); // Forcer la détection de changements
      },
      error: (error) => {
        console.error('Erreur de recherche:', error);
        this.isLoading = false;
        this.results = [];
        this.cdr.detectChanges(); // Forcer la détection de changements
      }
    });
  }

  /**
   * Changer la page
   */
  changePage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        q: this.searchQuery, 
        page,
        sort: this.sortOption !== 'relevance' ? this.sortOption : null
      },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Changer le tri
   */
  changeSort(option: string): void {
    this.sortOption = option;
    this.currentPage = 0;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        q: this.searchQuery, 
        page: 0,
        sort: option !== 'relevance' ? option : null,
        tags: this.selectedTags.length > 0 ? this.selectedTags.join(',') : null
      },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Toggle un tag dans la sélection
   */
  toggleTag(tagId: string): void {
    const wasSelected = this.isTagSelected(tagId);
    
    if (wasSelected) {
      // Retirer le tag
      this.selectedTags = this.selectedTags.filter(id => String(id) !== String(tagId));
    } else {
      // Ajouter le tag seulement s'il n'est pas déjà présent (double protection)
      if (!this.selectedTags.includes(String(tagId))) {
        this.selectedTags.push(String(tagId));
      }
      // Effacer la recherche textuelle quand on sélectionne un tag
      this.searchQuery = '';
    }
    
    // S'assurer qu'il n'y a pas de doublons (sécurité supplémentaire)
    this.selectedTags = [...new Set(this.selectedTags)];
    
    // Réinitialiser à la page 0 et mettre à jour l'URL
    this.currentPage = 0;
    
    // Construire les nouveaux query params
    const newParams: any = {
      page: 0,
      sort: this.sortOption !== 'relevance' ? this.sortOption : null,
      tags: this.selectedTags.length > 0 ? this.selectedTags.join(',') : null,
      q: this.selectedTags.length > 0 ? null : (this.searchQuery || null)
    };
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParams,
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Vérifier si un tag est sélectionné
   */
  isTagSelected(tagId: string): boolean {
    // S'assurer que la comparaison est en string (sans log pour éviter le spam)
    return this.selectedTags.includes(String(tagId));
  }

  /**
   * Effacer tous les filtres de tags
   */
  clearTags(): void {
    this.selectedTags = [];
    this.currentPage = 0;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        q: this.searchQuery, 
        page: 0,
        sort: this.sortOption !== 'relevance' ? this.sortOption : null,
        tags: null
      },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Récupérer le nom d'un tag par son ID
   */
  getTagName(tagId: string): string {
    if (!this.allTags || this.allTags.length === 0) {
      return '...'; // Tags pas encore chargés
    }
    const tag = this.allTags.find(t => String(t.id) === String(tagId));
    return tag ? tag.name : tagId; // Retourner l'ID si le tag n'existe pas
  }
  
  /**
   * Récupérer l'objet Tag complet par son ID
   */
  getTag(tagId: string): Tag | undefined {
    return this.allTags.find(t => String(t.id) === String(tagId));
  }

  /**
   * Naviguer vers un projet
   */
  goToProject(result: SearchResult): void {
    // Naviguer vers la page de détail du projet en utilisant le titre
    this.router.navigate(['/project', result.title]);
  }

  /**
   * Obtenir le nombre total de pages
   */
  get totalPages(): number {
    return Math.ceil(this.totalHits / this.pageSize);
  }

  /**
   * Obtenir les numéros de pages à afficher
   */
  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let startPage = Math.max(0, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(this.totalPages - 1, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
      startPage = Math.max(0, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }
}
