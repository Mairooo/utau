import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LikesService, LikeStatusResponse } from '../../services/likes.service';
import { AuthService } from '../../services/auth.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-like-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      (click)="toggleLike($event)"
      [disabled]="isLoading || !isAuthenticated"
      class="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 relative z-10"
      [ngClass]="{
        'bg-red-50 text-red-600 hover:bg-red-100': isLiked,
        'bg-gray-100 text-gray-600 hover:bg-gray-200': !isLiked,
        'opacity-50 cursor-not-allowed': isLoading || !isAuthenticated
      }"
    >
      <!-- Icône coeur -->
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        [attr.fill]="isLiked ? 'currentColor' : 'none'"
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        class="w-5 h-5 transition-all"
        [ngClass]="{
          'animate-ping-once': justLiked
        }"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
        />
      </svg>
      
      <!-- Compteur de likes -->
      <span class="font-medium text-sm">{{ likesCount }}</span>
    </button>
  `,
  styles: [`
    @keyframes ping-once {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.3);
      }
      100% {
        transform: scale(1);
      }
    }
    
    .animate-ping-once {
      animation: ping-once 0.3s ease-in-out;
    }
  `]
})
export class LikeButtonComponent implements OnInit, OnChanges, OnDestroy {
  @Input() projectId!: string;
  @Input() initialLikesCount: number = 0;
  @Output() likesChanged = new EventEmitter<number>();
  
  isLiked = false;
  likesCount = 0;
  isLoading = false;
  isAuthenticated = false;
  justLiked = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private likesService: LikesService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Vérifier l'authentification
    this.isAuthenticated = this.authService.isAuthenticated;
    
    // Utiliser la valeur initiale si fournie
    this.likesCount = this.initialLikesCount;
    
    console.log('LikeButton init:', {
      projectId: this.projectId,
      isAuthenticated: this.isAuthenticated,
      initialLikesCount: this.initialLikesCount
    });
    
    if (this.isAuthenticated && this.projectId) {
      // Charger le statut de like initial depuis l'API
      this.loadLikeStatus();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Réagir aux changements de projectId ou initialLikesCount
    if (changes['initialLikesCount'] && !changes['initialLikesCount'].firstChange) {
      this.likesCount = changes['initialLikesCount'].currentValue;
      this.cdr.markForCheck();
    }
    
    if (changes['projectId'] && !changes['projectId'].firstChange) {
      const newProjectId = changes['projectId'].currentValue;
      if (newProjectId && this.isAuthenticated) {
        this.loadLikeStatus();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Charger le statut de like depuis l'API
   */
  private loadLikeStatus(): void {
    if (!this.projectId) return;
    
    console.log('Chargement statut like pour:', this.projectId);
    this.isLoading = true;
    
    this.likesService.getLikeStatus(this.projectId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (status) => {
        console.log('Statut like reçu:', status);
        this.isLiked = status.user_has_liked;
        this.likesCount = status.total_likes;
        this.isLoading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur lors du chargement du statut de like:', error);
        this.isLoading = false;
        this.cdr.markForCheck();
        // Garder la valeur initiale en cas d'erreur
      }
    });
  }

  /**
   * Toggle le like (like/unlike)
   */
  toggleLike(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Re-vérifier l'authentification à chaque clic
    this.isAuthenticated = this.authService.isAuthenticated;
    
    if (!this.isAuthenticated || this.isLoading) {
      console.log('Like bloqué:', { isAuthenticated: this.isAuthenticated, isLoading: this.isLoading });
      return;
    }
    
    console.log('Toggle like pour projet:', this.projectId);
    this.isLoading = true;
    
    this.likesService.toggleLike(this.projectId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log('Réponse toggle like:', response);
        this.isLiked = response.data.user_has_liked;
        this.likesCount = response.data.likes_count;
        this.isLoading = false;
        
        // Émettre le nouveau nombre de likes au parent
        this.likesChanged.emit(this.likesCount);
        
        // Forcer la détection de changements
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        
        // Animation lors du like
        if (response.action === 'liked') {
          this.justLiked = true;
          setTimeout(() => {
            this.justLiked = false;
            this.cdr.markForCheck();
          }, 300);
        }
      },
      error: (error) => {
        console.error('Erreur lors du toggle like:', error);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
