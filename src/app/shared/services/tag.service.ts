import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tag } from '../interfaces/tag.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TagService {
  private baseUrl = environment.directusUrl;

  constructor(private http: HttpClient) {}

  /**
   * Récupère tous les tags disponibles, triés par nom
   */
  getAllTags(): Observable<{ data: Tag[] }> {
    return this.http.get<{ data: Tag[] }>(`${this.baseUrl}/items/Tags?sort=name`);
  }

  /**
   * Récupère les tags les plus populaires (limité à un nombre spécifique)
   * Pour l'instant, retourne simplement les N premiers tags par ordre alphabétique
   */
  getPopularTags(limit: number = 6): Observable<{ data: Tag[] }> {
    return this.http.get<{ data: Tag[] }>(`${this.baseUrl}/items/Tags?sort=name&limit=${limit}`);
  }

  /**
   * Récupère un tag par son ID
   */
  getTagById(id: string): Observable<{ data: Tag }> {
    return this.http.get<{ data: Tag }>(`${this.baseUrl}/items/Tags/${id}`);
  }

  /**
   * Crée un nouveau tag (nécessite un token admin)
   */
  createTag(tagData: { name: string }, token: string): Observable<{ data: Tag }> {
    return this.http.post<{ data: Tag }>(
      `${this.baseUrl}/items/Tags`,
      tagData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /**
   * Met à jour un tag (nécessite un token admin)
   */
  updateTag(id: string, tagData: Partial<Tag>, token: string): Observable<{ data: Tag }> {
    return this.http.patch<{ data: Tag }>(
      `${this.baseUrl}/items/Tags/${id}`,
      tagData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /**
   * Supprime un tag (nécessite un token admin)
   */
  deleteTag(id: string, token: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/items/Tags/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}
