import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Projects } from '../interfaces/project.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Api {

  private baseUrl = environment.directusUrl;

  constructor(private http: HttpClient) {}

  // ---------------- Auth ----------------
  // penser à le nettoyer

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/auth/login`, { email, password });
  }

  registerUser(userData: { first_name: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/register`, userData);
  }

  getMe(token: string, fields = 'id,first_name,last_name,avatar,description'): Observable<any> {
    const ts = Date.now();
    return this.http.get(
      `${this.baseUrl}/users/me?fields=${encodeURIComponent(fields)}&_=${ts}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  // ---------------- Projects ----------------

  getprojects(): Observable<{ data: Projects[] }> {
    return this.http.get<{ data: Projects[] }>(
      `${this.baseUrl}/items/Projects?fields=*,likes_count,user_created.id,user_created.first_name,user_created.last_name,user_created.email`
    );
  }

  createProjects(ProjectsData: any, token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/items/Projects`, ProjectsData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getProjectsByName(name: string): Observable<any> {
    // Pour récupérer les tags d'une relation M2M via la table de jonction Projects_Tags
    // On doit accéder à tags.Tags_id.* pour récupérer les données du tag
    const fields = '*,likes_count,user_created.*,primary_voicebank.*,tags.Tags_id.*,rendered_audio,composition_data';
    return this.http.get(`${this.baseUrl}/items/Projects?filter[title][_eq]=${encodeURIComponent(name)}&fields=${fields}`);
  }

  getProjectById(id: string): Observable<any> {
    const fields = '*,likes_count,user_created.*,primary_voicebank.*,tags.Tags_id.*,rendered_audio,composition_data';
    return this.http.get(`${this.baseUrl}/items/Projects/${encodeURIComponent(id)}?fields=${fields}`);
  }

  updateProjects(name: string, ProjectsData: any, token: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/items/Projects/${name}`, ProjectsData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  deleteProjects(name: string, token: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/items/Projects/${name}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // --------- User-specific projects ---------
  getUserProjects(userId: string, fields: string[]): Observable<{ data: Projects[] }> {
    const f = encodeURIComponent(fields.join(','));
    const ts = Date.now();
    return this.http.get<{ data: Projects[] }>(
      `${this.baseUrl}/items/Projects?fields=${f}&filter[user_created][_eq]=${encodeURIComponent(userId)}&_=${ts}`
    );
  }

  countUserProjects(userId: string): Observable<{ data: []; meta?: { total_count?: number } }> {
    const ts = Date.now();
    return this.http.get<{ data: []; meta?: { total_count?: number } }>(
      `${this.baseUrl}/items/Projects?limit=0&meta=total_count&filter[user_created][_eq]=${encodeURIComponent(userId)}&_=${ts}`
    );
  }

  // ---------------- Users ----------------
  updateUser(userId: string, data: any): Observable<{ data: unknown }> {
    return this.http.patch<{ data: unknown }>(`${this.baseUrl}/users/${encodeURIComponent(userId)}`, data);
  }

  // ---------------- Files ----------------
  uploadFile(file: File): Observable<{ data: { id: string } }> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Le token devrait être ajouté automatiquement par l'interceptor,
    // mais on le fait explicitement pour les uploads de fichiers
    const token = localStorage.getItem('directus_access_token');
    const options = token 
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {};
    
    return this.http.post<{ data: { id: string } }>(`${this.baseUrl}/files`, formData, options);
  }


// ---------------- Notes ----------------

getNotesByProjects(ProjectsId: string): Observable<any> {
  return this.http.get(`${this.baseUrl}/items/notes?filter[Projects_id][_eq]=${ProjectsId}`);
}

addNote(noteData: any, token: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/items/notes`, noteData, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

updateNote(noteId: string, noteData: any, token: string): Observable<any> {
  return this.http.patch(`${this.baseUrl}/items/notes/${noteId}`, noteData, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

deleteNote(noteId: string, token: string): Observable<any> {
  return this.http.delete(`${this.baseUrl}/items/notes/${noteId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// ---------------- PhonÃ¨mes ----------------

getAllPhonemes(): Observable<any> {
  return this.http.get(`${this.baseUrl}/items/phonemes`);
}

getPhonemesByIds(ids: string[]): Observable<any> {
  const idFilter = ids.join(',');
  return this.http.get(`${this.baseUrl}/items/phonemes?filter[id][_in]=${idFilter}`);
}

// ---------------- Projects par nom ----------------

getProjectsByTitle(title: string, token: string): Observable<any> {
  return this.http.get(`${this.baseUrl}/items/Projects?filter[title][_eq]=${title}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

updateProjectsById(ProjectsId: string, ProjectsData: any, token: string): Observable<any> {
  return this.http.patch(`${this.baseUrl}/items/Projects/${ProjectsId}`, ProjectsData, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// Nouvelle méthode qui utilise l'interceptor pour le token
updateProject(projectId: string, projectData: any): Observable<any> {
  return this.http.patch(`${this.baseUrl}/items/Projects/${projectId}`, projectData);
}

createProject(projectData: any): Observable<any> {
  return this.http.post(`${this.baseUrl}/items/Projects`, projectData);
}

// ---------------- Project Stats ----------------

incrementProjectStats(ProjectsId: string, field: 'plays' | 'downloads'): Observable<any> {
  // Récupérer d'abord la valeur actuelle
  return new Observable(observer => {
    this.http.get(`${this.baseUrl}/items/Projects/${ProjectsId}?fields=${field}`).subscribe({
      next: (response: any) => {
        const currentValue = response.data?.[field] || 0;
        const token = localStorage.getItem('directus_access_token');
        
        // Préparer les headers (avec ou sans token)
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Incrémenter (fonctionne même sans token si les permissions Public le permettent)
        this.http.patch(`${this.baseUrl}/items/Projects/${ProjectsId}`, 
          { [field]: currentValue + 1 },
          { headers }
        ).subscribe({
          next: (result) => observer.next(result),
          error: (err) => observer.error(err)
        });
      },
      error: (err) => observer.error(err)
    });
  });
}

// ---------------- Project Plays (tracking) ----------------

/**
 * Vérifie si l'utilisateur actuel a déjà écouté ce projet
 * @param projectId ID du projet
 * @returns Observable<boolean> - true si déjà écouté, false sinon
 */
checkUserPlay(projectId: string): Observable<boolean> {
  return new Observable(observer => {
    const token = localStorage.getItem('directus_access_token');
    
    if (!token) {
      // Utilisateur non authentifié, on considère qu'il n'a pas écouté
      observer.next(false);
      observer.complete();
      return;
    }

    // Récupérer l'ID de l'utilisateur actuel
    this.getMe(token, 'id').subscribe({
      next: (userResponse: any) => {
        const userId = userResponse.data?.id;
        
        if (!userId) {
          observer.next(false);
          observer.complete();
          return;
        }

        // Vérifier si une entrée existe déjà dans project_plays
        const filter = `filter[user_id][_eq]=${userId}&filter[project_id][_eq]=${projectId}`;
        this.http.get(`${this.baseUrl}/items/project_plays?${filter}&limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe({
          next: (response: any) => {
            const hasPlayed = response.data && response.data.length > 0;
            observer.next(hasPlayed);
            observer.complete();
          },
          error: (err) => {
            console.error('Erreur lors de la vérification du play:', err);
            observer.next(false);
            observer.complete();
          }
        });
      },
      error: (err) => {
        console.error('Erreur lors de la récupération de l\'utilisateur:', err);
        observer.next(false);
        observer.complete();
      }
    });
  });
}

/**
 * Enregistre qu'un utilisateur a écouté un projet
 * @param projectId ID du projet
 * @returns Observable<any>
 */
recordUserPlay(projectId: string): Observable<any> {
  return new Observable(observer => {
    const token = localStorage.getItem('directus_access_token');
    
    if (!token) {
      // Utilisateur non authentifié, on n'enregistre pas
      observer.error('Utilisateur non authentifié');
      return;
    }

    // Récupérer l'ID de l'utilisateur actuel
    this.getMe(token, 'id').subscribe({
      next: (userResponse: any) => {
        const userId = userResponse.data?.id;
        
        if (!userId) {
          observer.error('ID utilisateur introuvable');
          return;
        }

        // Créer l'entrée dans project_plays
        const playData = {
          user_id: userId,
          project_id: projectId,
          date_played: new Date().toISOString()
        };

        this.http.post(`${this.baseUrl}/items/project_plays`, playData, {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe({
          next: (result) => {
            observer.next(result);
            observer.complete();
          },
          error: (err) => {
            // Si l'erreur est due à une contrainte unique (doublon), on l'ignore
            if (err.status === 400 || err.status === 409) {
              console.warn('Play déjà enregistré pour cet utilisateur/projet');
              observer.next(null);
              observer.complete();
            } else {
              observer.error(err);
            }
          }
        });
      },
      error: (err) => {
        observer.error(err);
      }
    });
  });
}

// ---------------- Project Likes ----------------

/**
 * Récupérer les projets likés par un utilisateur
 * @param userId ID de l'utilisateur
 * @returns Observable avec les projets likés
 */
getUserLikedProjects(userId: string): Observable<any> {
  const token = localStorage.getItem('directus_access_token');
  if (!token) {
    return new Observable(observer => {
      observer.next({ data: [] });
      observer.complete();
    });
  }

  // Récupérer les likes avec les détails des projets via la relation
  const fields = 'project_id.id,project_id.title,project_id.description,project_id.cover_image,project_id.status,project_id.likes_count,project_id.plays,project_id.duration';
  return this.http.get(
    `${this.baseUrl}/items/projects_likes?filter[user_id][_eq]=${encodeURIComponent(userId)}&fields=${encodeURIComponent(fields)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

/**
 * Liker un projet
 * @param projectId ID du projet
 * @returns Observable
 */
likeProject(projectId: string): Observable<any> {
  const token = localStorage.getItem('directus_access_token');
  if (!token) {
    return new Observable(observer => observer.error('Non authentifié'));
  }

  return this.http.post(
    `${this.baseUrl}/items/projects_likes`,
    { project_id: projectId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

/**
 * Unliker un projet
 * @param likeId ID du like à supprimer
 * @returns Observable
 */
unlikeProject(likeId: string): Observable<any> {
  const token = localStorage.getItem('directus_access_token');
  if (!token) {
    return new Observable(observer => observer.error('Non authentifié'));
  }

  return this.http.delete(
    `${this.baseUrl}/items/projects_likes/${encodeURIComponent(likeId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}


}