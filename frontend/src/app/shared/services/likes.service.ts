import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LikeToggleResponse {
  success: boolean;
  action: 'liked' | 'unliked';
  message: string;
  data: {
    project_id: string;
    user_id: string;
    likes_count: number;
    user_has_liked: boolean;
  };
}

export interface LikeStatusResponse {
  project_id: string;
  user_has_liked: boolean;
  total_likes: number;
}

export interface UserLikesResponse {
  success: boolean;
  data: any[];
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class LikesService {
  private apiUrl = `${environment.directusUrl}/like-manager`;
  
  // Cache pour stocker l'état des likes en mémoire
  private likesCache = new Map<string, BehaviorSubject<LikeStatusResponse>>();

  constructor(private http: HttpClient) {}

  /**
   * Toggle le like sur un projet (like ou unlike automatique)
   */
  toggleLike(projectId: string): Observable<LikeToggleResponse> {
    return this.http.post<LikeToggleResponse>(`${this.apiUrl}/toggle`, {
      project_id: projectId
    }).pipe(
      tap(response => {
        // Mettre à jour le cache après le toggle
        this.updateCache(projectId, {
          project_id: projectId,
          user_has_liked: response.data.user_has_liked,
          total_likes: response.data.likes_count
        });
      })
    );
  }

  /**
   * Récupérer le statut de like d'un projet
   */
  getLikeStatus(projectId: string): Observable<LikeStatusResponse> {
    return this.http.get<LikeStatusResponse>(`${this.apiUrl}/status/${projectId}`).pipe(
      tap(status => this.updateCache(projectId, status))
    );
  }

  /**
   * Récupérer tous les projets likés par l'utilisateur
   */
  getUserLikes(): Observable<UserLikesResponse> {
    return this.http.get<UserLikesResponse>(`${this.apiUrl}/user-likes`);
  }

  /**
   * Observer le statut de like d'un projet (pour updates en temps réel)
   */
  watchLikeStatus(projectId: string): Observable<LikeStatusResponse> {
    if (!this.likesCache.has(projectId)) {
      const subject = new BehaviorSubject<LikeStatusResponse>({
        project_id: projectId,
        user_has_liked: false,
        total_likes: 0
      });
      this.likesCache.set(projectId, subject);
      
      // Charger le statut initial
      this.getLikeStatus(projectId).subscribe();
    }
    
    return this.likesCache.get(projectId)!.asObservable();
  }

  /**
   * Mettre à jour le cache
   */
  private updateCache(projectId: string, status: LikeStatusResponse): void {
    if (this.likesCache.has(projectId)) {
      this.likesCache.get(projectId)!.next(status);
    } else {
      const subject = new BehaviorSubject<LikeStatusResponse>(status);
      this.likesCache.set(projectId, subject);
    }
  }

  /**
   * Vider le cache (utile lors de la déconnexion)
   */
  clearCache(): void {
    this.likesCache.clear();
  }
}
