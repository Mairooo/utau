import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Comment {
  id: number;
  content: string;
  project_id: string;
  user_created: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
  } | string;
  date_created: string;
  parent_id?: number;
  replies?: Comment[];
}

export interface CommentsResponse {
  data: Comment[];
}

export interface CreateCommentResponse {
  data: Comment;
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private readonly apiUrl = `${environment.directusUrl}/items/comments`;
  
  readonly comments = signal<Comment[]>([]);
  readonly loading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('directus_access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Récupérer les commentaires d'un projet
   */
  fetchComments(projectId: string): Observable<Comment[]> {
    this.loading.set(true);
    const params = {
      'filter[project_id][_eq]': projectId,
      'filter[parent_id][_null]': 'true',
      'sort': '-date_created',
      'fields': '*,user_created.id,user_created.first_name,user_created.last_name,user_created.avatar'
    };
    
    return this.http.get<CommentsResponse>(this.apiUrl, { 
      headers: this.getHeaders(),
      params 
    }).pipe(
      map(response => response.data),
      tap(comments => {
        this.comments.set(comments);
        this.loading.set(false);
      })
    );
  }

  /**
   * Récupérer les réponses d'un commentaire
   */
  fetchReplies(parentId: number): Observable<Comment[]> {
    const params = {
      'filter[parent_id][_eq]': parentId.toString(),
      'sort': 'date_created',
      'fields': '*,user_created.id,user_created.first_name,user_created.last_name,user_created.avatar'
    };
    
    return this.http.get<CommentsResponse>(this.apiUrl, { 
      headers: this.getHeaders(),
      params 
    }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Ajouter un commentaire
   */
  addComment(projectId: string, content: string, parentId?: number): Observable<Comment> {
    const body: any = {
      content,
      project_id: projectId
    };
    
    if (parentId) {
      body.parent_id = parentId;
    }
    
    // Ajouter fields pour récupérer les infos utilisateur complètes
    const params = {
      'fields': '*,user_created.id,user_created.first_name,user_created.last_name,user_created.avatar'
    };
    
    return this.http.post<CreateCommentResponse>(this.apiUrl, body, { 
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => response.data),
      tap(newComment => {
        if (!parentId) {
          // Ajouter en tête de liste pour les commentaires principaux
          this.comments.set([newComment, ...this.comments()]);
        }
      })
    );
  }

  /**
   * Supprimer un commentaire
   */
  deleteComment(commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${commentId}`, { 
      headers: this.getHeaders() 
    }).pipe(
      tap(() => {
        // Retirer du cache local
        this.comments.set(this.comments().filter(c => c.id !== commentId));
      })
    );
  }

  /**
   * Compter les commentaires d'un projet
   */
  getCommentsCount(projectId: string): Observable<number> {
    const params = {
      'filter[project_id][_eq]': projectId,
      'aggregate[count]': 'id'
    };
    
    return this.http.get<any>(this.apiUrl, { 
      headers: this.getHeaders(),
      params 
    }).pipe(
      map(response => response.data?.[0]?.count?.id || 0)
    );
  }
}
