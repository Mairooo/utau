import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ProjectData {
  id?: string;
  title: string;
  description?: string;
  tempo: number;
  primary_voicebank?: string | any; // ID de la voicebank ou objet complet
  composition_data?: string | any[]; // JSON stringifié ou array d'objets
  status?: string;
  cover_image?: string;
  user_created?: string;
  date_created?: string;
  date_updated?: string;
}

export interface Note {
  id: string;
  pitch: string;
  phoneme: string;
  startTime: number;
  duration: number;
  measure: number;
  position: number;
}

@Injectable({
  providedIn: 'root'
})
export class CompositionService {
  private readonly apiUrl = 'http://localhost:8055';
  private currentUserId: string | null = null;

  constructor(private http: HttpClient) {
    // Récupérer l'ID de l'utilisateur connecté au démarrage
    this.getCurrentUser();
  }

  /**
   * Récupérer l'utilisateur connecté
   */
  private getCurrentUser(): void {
    this.http.get<any>(`${this.apiUrl}/users/me`).subscribe({
      next: (response) => {
        this.currentUserId = response.data?.id;
        console.log('Current user ID:', this.currentUserId);
      },
      error: (err) => {
        console.error('Error getting current user:', err);
      }
    });
  }

  /**
   * Récupérer tous les projets de l'utilisateur connecté
   */
  getMyProjects(): Observable<ProjectData[]> {
    // Filtrer par utilisateur connecté
    return this.http.get<any>(`${this.apiUrl}/items/Projects`, {
      params: {
        fields: 'id,title,description,tempo,primary_voicebank.*,composition_data,status,cover_image,date_created,date_updated,user_created',
        sort: '-date_updated',
        filter: JSON.stringify({
          user_created: {
            _eq: '$CURRENT_USER'
          }
        })
      }
    }).pipe(
      map(response => response.data || [])
    );
  }

  /**
   * Récupérer un projet spécifique
   */
  getProject(id: string): Observable<ProjectData> {
    return this.http.get<any>(`${this.apiUrl}/items/Projects/${id}`, {
      params: {
        fields: 'id,title,description,tempo,primary_voicebank.*,composition_data,status,cover_image,date_created,date_updated,user_created'
      }
    }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Créer un nouveau projet
   */
  createProject(project: ProjectData): Observable<ProjectData> {
    return this.http.post<any>(`${this.apiUrl}/items/Projects`, project).pipe(
      map(response => response.data)
    );
  }

  /**
   * Mettre à jour un projet existant
   */
  updateProject(id: string, project: Partial<ProjectData>): Observable<ProjectData> {
    return this.http.patch<any>(`${this.apiUrl}/items/Projects/${id}`, project).pipe(
      map(response => response.data)
    );
  }

  /**
   * Supprimer un projet
   */
  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/items/Projects/${id}`);
  }

  /**
   * Sauvegarder la composition (notes) dans un projet
   */
  saveComposition(projectId: string | undefined, data: {
    title: string;
    description?: string;
    tempo: number;
    voicebankId: string;
    notes: Note[];
  }): Observable<ProjectData> {
    // Directus attend un objet JSON, pas une string
    const payload: any = {
      title: data.title,
      description: data.description,
      tempo: data.tempo,
      primary_voicebank: data.voicebankId,
      composition_data: data.notes, // Directus convertit automatiquement en JSON
      status: 'draft'
    };

    // Ajouter user_created uniquement lors de la création
    if (!projectId && this.currentUserId) {
      payload.user_created = this.currentUserId;
    }

    console.log('Payload to send:', payload);

    if (projectId) {
      // Mise à jour
      console.log('Updating project:', projectId);
      return this.http.patch<any>(
        `${this.apiUrl}/items/Projects/${projectId}`,
        payload
      ).pipe(
        map(response => {
          console.log('Update response:', response);
          return response.data;
        })
      );
    } else {
      // Création
      console.log('Creating new project');
      return this.http.post<any>(
        `${this.apiUrl}/items/Projects`,
        payload
      ).pipe(
        map(response => {
          console.log('Create response:', response);
          return response.data;
        })
      );
    }
  }

  /**
   * Charger les notes d'une composition
   */
  loadCompositionNotes(project: ProjectData): Note[] {
    if (!project.composition_data) return [];
    
    try {
      // Si c'est déjà un objet/array, le retourner directement
      if (typeof project.composition_data === 'object') {
        return project.composition_data as any;
      }
      // Sinon, parser la string JSON
      return JSON.parse(project.composition_data);
    } catch (e) {
      console.error('Error parsing composition data:', e);
      return [];
    }
  }

  /**
   * Exporter un projet en JSON
   */
  exportProject(project: ProjectData): void {
    const exportData = {
      title: project.title,
      description: project.description,
      tempo: project.tempo,
      voicebank: project.primary_voicebank,
      notes: this.loadCompositionNotes(project),
      exported_at: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title || 'project'}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Importer un projet depuis un fichier JSON
   */
  importProject(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
