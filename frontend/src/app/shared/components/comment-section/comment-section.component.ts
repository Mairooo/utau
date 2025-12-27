import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommentService, Comment } from '../../services/comment.service';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface CurrentUser {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar?: string;
}

@Component({
  selector: 'app-comment-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <!-- Formulaire d'ajout -->
      @if (isAuthenticated) {
        <div class="mb-8">
          <div class="flex gap-3">
            <!-- Avatar utilisateur connecté -->
            <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold flex-shrink-0 overflow-hidden">
              @if (currentUserAvatarUrl) {
                <img [src]="currentUserAvatarUrl" alt="Avatar" class="w-full h-full object-cover" />
              } @else {
                {{ currentUserInitial }}
              }
            </div>
            <div class="flex-1">
              <textarea
                [(ngModel)]="newComment"
                placeholder="Partagez vos impressions sur ce projet..."
                rows="3"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              ></textarea>
              <div class="flex justify-end mt-3">
                <button
                  (click)="submitComment()"
                  [disabled]="!newComment.trim() || submitting()"
                  class="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  @if (submitting()) {
                    <span class="flex items-center gap-2">
                      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Envoi...
                    </span>
                  } @else {
                    Publier le commentaire
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="mb-8 p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600">
          <a href="/login" class="text-gray-900 font-medium hover:underline">Connectez-vous</a> pour laisser un commentaire
        </div>
      }

      <!-- Liste des commentaires -->
      @if (loading()) {
        <div class="flex justify-center py-8">
          <div class="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
        </div>
      } @else if (comments().length === 0) {
        <div class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <p>Aucun commentaire pour le moment</p>
          <p class="text-sm mt-1">Soyez le premier à commenter !</p>
        </div>
      } @else {
        <div class="space-y-6">
          @for (comment of comments(); track comment.id) {
            <div class="flex gap-3">
              <!-- Avatar -->
              <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold flex-shrink-0 overflow-hidden">
                @if (getAvatarUrl(comment)) {
                  <img [src]="getAvatarUrl(comment)" alt="Avatar" class="w-full h-full object-cover" />
                } @else {
                  {{ getUserInitial(comment) }}
                }
              </div>
              
              <!-- Contenu -->
              <div class="flex-1">
                <!-- Header: nom + date -->
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold text-gray-900">{{ getUserName(comment) }}</span>
                  <span class="text-sm text-gray-400">{{ formatDate(comment.date_created) }}</span>
                </div>
                
                <!-- Texte du commentaire -->
                <p class="text-gray-700 text-[15px] leading-relaxed mb-3">{{ comment.content }}</p>
                
                <!-- Actions -->
                <div class="flex items-center gap-4">
                  <!-- Répondre -->
                  <button 
                    (click)="toggleReplyForm(comment.id)"
                    class="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                    </svg>
                    <span class="text-sm">Répondre</span>
                  </button>
                  
                  <!-- Menu ... (supprimer) -->
                  @if (canDelete(comment)) {
                    <button 
                      (click)="deleteComment(comment.id)"
                      class="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Supprimer"
                    >
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="5" cy="12" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="19" cy="12" r="2"/>
                      </svg>
                    </button>
                  }
                </div>

                <!-- Formulaire de réponse -->
                @if (replyingTo() === comment.id) {
                  <div class="mt-4 flex gap-2">
                    <input
                      [(ngModel)]="replyContent"
                      placeholder="Votre réponse..."
                      class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      (keydown.enter)="submitReply(comment.id)"
                    />
                    <button
                      (click)="submitReply(comment.id)"
                      [disabled]="!replyContent.trim()"
                      class="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-800 disabled:opacity-50"
                    >
                      Envoyer
                    </button>
                    <button
                      (click)="toggleReplyForm(null)"
                      class="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                }

                <!-- Réponses -->
                @if (comment.replies && comment.replies.length > 0) {
                  <!-- Bouton pour afficher/masquer les réponses -->
                  <button 
                    (click)="toggleReplies(comment.id)"
                    class="mt-3 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <svg 
                      class="w-4 h-4 transition-transform" 
                      [class.rotate-180]="isRepliesExpanded(comment.id)"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                    @if (isRepliesExpanded(comment.id)) {
                      Masquer les réponses
                    } @else {
                      Voir les réponses
                    }
                  </button>
                  
                  <!-- Liste des réponses (déroulant) -->
                  @if (isRepliesExpanded(comment.id)) {
                    <div class="mt-4 ml-6 space-y-4">
                      @for (reply of comment.replies; track reply.id) {
                        <div class="flex gap-3">
                          <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold flex-shrink-0 overflow-hidden">
                            @if (getAvatarUrl(reply)) {
                              <img [src]="getAvatarUrl(reply)" alt="Avatar" class="w-full h-full object-cover" />
                            } @else {
                              {{ getUserInitial(reply) }}
                            }
                          </div>
                          <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                              <span class="font-semibold text-gray-900 text-sm">{{ getUserName(reply) }}</span>
                              <span class="text-xs text-gray-400">{{ formatDate(reply.date_created) }}</span>
                            </div>
                            <p class="text-gray-700 text-sm leading-relaxed">{{ reply.content }}</p>
                            
                            <!-- Actions pour les réponses -->
                            <div class="flex items-center gap-3 mt-2">
                              <button 
                                (click)="toggleReplyForm(reply.id)"
                                class="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                                </svg>
                                <span class="text-xs">Répondre</span>
                              </button>
                              
                              @if (canDelete(reply)) {
                                <button 
                                  (click)="deleteComment(reply.id)"
                                  class="text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Supprimer"
                                >
                                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="5" cy="12" r="1.5"/>
                                    <circle cx="12" cy="12" r="1.5"/>
                                    <circle cx="19" cy="12" r="1.5"/>
                                  </svg>
                                </button>
                              }
                            </div>

                            <!-- Formulaire de réponse à une réponse -->
                            @if (replyingTo() === reply.id) {
                              <div class="mt-3 flex gap-2">
                                <input
                                  type="text"
                                  [(ngModel)]="replyContent"
                                  placeholder="Votre réponse..."
                                  class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  (keydown.enter)="submitReply(comment.id)"
                                />
                                <button
                                  (click)="submitReply(comment.id)"
                                  [disabled]="!replyContent.trim() || submitting()"
                                  class="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  Envoyer
                                </button>
                                <button
                                  (click)="toggleReplyForm(null)"
                                  class="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                  Annuler
                                </button>
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class CommentSectionComponent implements OnInit {
  @Input() projectId!: string;

  newComment = '';
  replyContent = '';
  
  comments = signal<Comment[]>([]);
  loading = signal(false);
  readonly submitting = signal(false);
  readonly replyingTo = signal<number | null>(null);
  readonly expandedReplies = signal<Set<number>>(new Set());
  
  isAuthenticated = false;
  currentUser: CurrentUser | null = null;

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  get currentUserInitial(): string {
    if (this.currentUser?.first_name) return this.currentUser.first_name.charAt(0).toUpperCase();
    if (this.currentUser?.email) return this.currentUser.email.charAt(0).toUpperCase();
    return '?';
  }

  get currentUserAvatarUrl(): string | null {
    if (this.currentUser?.avatar) {
      return `${environment.directusUrl}/assets/${this.currentUser.avatar}`;
    }
    return null;
  }

  ngOnInit(): void {
    this.isAuthenticated = this.authService.isAuthenticated;
    if (this.isAuthenticated) {
      this.loadCurrentUser();
    }
    if (this.projectId) {
      this.loadComments();
    }
  }

  loadCurrentUser(): void {
    const token = localStorage.getItem('directus_access_token');
    if (!token) return;
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    this.http.get<{ data: CurrentUser }>(`${environment.directusUrl}/users/me`, { headers })
      .subscribe({
        next: (response) => {
          this.currentUser = response.data;
        },
        error: (err) => console.error('Erreur chargement utilisateur:', err)
      });
  }

  loadComments(): void {
    this.loading.set(true);
    this.commentService.fetchComments(this.projectId).subscribe({
      next: (fetchedComments) => {
        this.comments.set(fetchedComments);
        this.loading.set(false);
        // Charger les réponses pour chaque commentaire
        fetchedComments.forEach(comment => {
          this.commentService.fetchReplies(comment.id).subscribe(replies => {
            comment.replies = replies;
            this.comments.set([...this.comments()]);
          });
        });
      },
      error: (err) => {
        console.error('Erreur chargement commentaires:', err);
        this.loading.set(false);
      }
    });
  }

  submitComment(): void {
    if (!this.newComment.trim()) return;
    
    this.submitting.set(true);
    this.commentService.addComment(this.projectId, this.newComment.trim()).subscribe({
      next: (newComment) => {
        this.comments.set([newComment, ...this.comments()]);
        this.newComment = '';
        this.submitting.set(false);
      },
      error: (err) => {
        console.error('Erreur ajout commentaire:', err);
        this.submitting.set(false);
      }
    });
  }

  toggleReplyForm(commentId: number | null): void {
    this.replyingTo.set(commentId);
    this.replyContent = '';
  }

  toggleReplies(commentId: number): void {
    const current = this.expandedReplies();
    const newSet = new Set(current);
    if (newSet.has(commentId)) {
      newSet.delete(commentId);
    } else {
      newSet.add(commentId);
    }
    this.expandedReplies.set(newSet);
  }

  isRepliesExpanded(commentId: number): boolean {
    return this.expandedReplies().has(commentId);
  }

  submitReply(parentId: number): void {
    if (!this.replyContent.trim()) return;
    
    this.commentService.addComment(this.projectId, this.replyContent.trim(), parentId).subscribe({
      next: (reply) => {
        // Ajouter la réponse au commentaire parent
        const comments = this.comments();
        const parent = comments.find(c => c.id === parentId);
        if (parent) {
          parent.replies = [...(parent.replies || []), reply];
        }
        this.replyContent = '';
        this.replyingTo.set(null);
      },
      error: (err) => console.error('Erreur ajout réponse:', err)
    });
  }

  deleteComment(commentId: number): void {
    if (!confirm('Supprimer ce commentaire ?')) return;
    
    this.commentService.deleteComment(commentId).subscribe({
      next: () => {
        // Vérifier si c'est un commentaire principal
        const isMainComment = this.comments().some(c => c.id === commentId);
        
        if (isMainComment) {
          // Supprimer le commentaire principal
          this.comments.set(this.comments().filter(c => c.id !== commentId));
        } else {
          // C'est une réponse, la supprimer du parent
          const updatedComments = this.comments().map(c => {
            if (c.replies) {
              c.replies = c.replies.filter(r => r.id !== commentId);
            }
            return c;
          });
          this.comments.set([...updatedComments]);
        }
      },
      error: (err) => console.error('Erreur suppression:', err)
    });
  }

  canDelete(comment: Comment): boolean {
    if (!this.currentUser) return false;
    const commentUserId = typeof comment.user_created === 'string' 
      ? comment.user_created 
      : comment.user_created?.id;
    // Convertir les deux en string pour la comparaison
    return String(this.currentUser.id) === String(commentUserId);
  }

  getUserName(comment: Comment): string {
    if (typeof comment.user_created === 'string') return 'Utilisateur';
    const user = comment.user_created;
    if (user?.first_name || user?.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return 'Utilisateur';
  }

  getUserInitial(comment: Comment): string {
    const name = this.getUserName(comment);
    return name.charAt(0).toUpperCase();
  }

  getAvatarUrl(comment: Comment): string | null {
    if (typeof comment.user_created === 'string') return null;
    const avatar = comment.user_created?.avatar;
    if (avatar) {
      return `http://localhost:8055/assets/${avatar}`;
    }
    return null;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
}
