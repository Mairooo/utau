import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SearchResponse,
  SearchSuggestionsResponse,
  SearchParams
} from '../interfaces/search.interface';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private readonly apiUrl = `${environment.directusUrl}/search`;

  constructor(private http: HttpClient) {}

  /**
   * Recherche de projets
   */
  searchProjects(params: SearchParams): Observable<SearchResponse> {
    let httpParams = new HttpParams();

    if (params.q !== undefined) {
      httpParams = httpParams.set('q', params.q);
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params.offset) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }
    if (params.voicebank) {
      httpParams = httpParams.set('voicebank', params.voicebank);
    }
    if (params.creator) {
      httpParams = httpParams.set('creator', params.creator);
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params.tags && params.tags.length > 0) {
      httpParams = httpParams.set('tags', params.tags.join(','));
    }

    return this.http.get<SearchResponse>(`${this.apiUrl}/projects`, { params: httpParams });
  }

  /**
   * Suggestions d'autocomplétion
   */
  getSuggestions(query: string, limit: number = 5): Observable<SearchSuggestionsResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit.toString());

    return this.http.get<SearchSuggestionsResponse>(`${this.apiUrl}/projects/suggest`, { params });
  }

  /**
   * Recherche par popularité
   */
  getPopularProjects(limit: number = 10): Observable<SearchResponse> {
    return this.searchProjects({
      q: '',
      limit,
      sort: 'likes_desc,plays_desc'
    });
  }

  /**
   * Recherche par créateur
   */
  searchByCreator(creatorId: string, limit: number = 20): Observable<SearchResponse> {
    return this.searchProjects({
      q: '',
      creator: creatorId,
      limit
    });
  }

  /**
   * Recherche par voicebank
   */
  searchByVoicebank(voicebankId: string, limit: number = 20): Observable<SearchResponse> {
    return this.searchProjects({
      q: '',
      voicebank: voicebankId,
      limit
    });
  }
}
