import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, filter } from 'rxjs/operators';
import { SearchService } from '../../services/search.service';
import { SearchSuggestion } from '../../interfaces/search.interface';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.css']
})
export class SearchBarComponent implements OnInit, OnDestroy {
  searchControl = new FormControl('');
  suggestions: SearchSuggestion[] = [];
  isLoading = false;
  showSuggestions = false;
  private destroy$ = new Subject<void>();

  constructor(
    private searchService: SearchService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Pré-remplir la barre de recherche avec le query param si présent
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const query = params['q'] || '';
        if (query !== this.searchControl.value) {
          this.searchControl.setValue(query, { emitEvent: false });
        }
        // Si la query est vide (tags sélectionnés), vider les suggestions
        if (!query) {
          this.suggestions = [];
          this.showSuggestions = false;
        }
      });

    // Écouter les changements dans le champ de recherche
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300), // Attendre 300ms après la dernière frappe
        distinctUntilChanged(), // Ne déclencher que si la valeur change
        filter(query => query !== null && query.length >= 2), // Minimum 2 caractères
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.loadSuggestions(query as string);
      });

    // Cacher les suggestions si la valeur est vide
    this.searchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(query => {
        if (!query || query.length < 2) {
          this.suggestions = [];
          this.showSuggestions = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Charger les suggestions d'autocomplétion
   */
  private loadSuggestions(query: string): void {
    this.isLoading = true;
    this.searchService.getSuggestions(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.suggestions = response.suggestions;
          this.showSuggestions = this.suggestions.length > 0;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des suggestions:', error);
          this.isLoading = false;
          this.suggestions = [];
          this.showSuggestions = false;
        }
      });
  }

  /**
   * Effectuer une recherche complète
   */
  onSearch(): void {
    const query = this.searchControl.value?.trim();
    if (query) {
      this.router.navigate(['/search'], { queryParams: { q: query } });
      this.showSuggestions = false;
    }
  }

  /**
   * Sélectionner une suggestion
   */
  selectSuggestion(suggestion: SearchSuggestion): void {
    // Naviguer vers la page de détail du projet en utilisant le titre
    this.router.navigate(['/project', suggestion.title]);
    this.searchControl.setValue('');
    this.showSuggestions = false;
  }

  /**
   * Cacher les suggestions
   */
  hideSuggestions(): void {
    // Délai pour permettre le mousedown sur une suggestion
    setTimeout(() => {
      this.showSuggestions = false;
    }, 150);
  }

  /**
   * Afficher les suggestions
   */
  onFocus(): void {
    if (this.suggestions.length > 0) {
      this.showSuggestions = true;
    }
  }

  /**
   * Effacer la recherche
   */
  clearSearch(): void {
    this.searchControl.setValue('');
    this.suggestions = [];
    this.showSuggestions = false;
  }
}
