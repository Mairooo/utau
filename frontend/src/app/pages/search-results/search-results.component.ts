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

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SearchBarComponent, LikeButtonComponent],
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
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Écouter les changements de query params
    this.route.queryParams
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(params => {
        this.searchQuery = params['q'] || '';
        this.currentPage = parseInt(params['page'] || '0');
        this.sortOption = params['sort'] || 'relevance';
        
        // Toujours effectuer la recherche si on a un query
        if (this.searchQuery) {
          this.performSearch();
        } else {
          // Pas de query, réinitialiser les résultats
          this.results = [];
          this.totalHits = 0;
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
    if (!this.searchQuery) {
      this.results = [];
      return;
    }

    this.isLoading = true;
    
    const sort = this.sortOption !== 'relevance' ? this.sortOption : undefined;

    this.searchService.searchProjects({
      q: this.searchQuery,
      limit: this.pageSize,
      offset: this.currentPage * this.pageSize,
      sort
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
        sort: option !== 'relevance' ? option : null
      },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Naviguer vers un projet
   */
  goToProject(projectId: string): void {
    this.router.navigate(['/composer', projectId]);
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
