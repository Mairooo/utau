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
    return this.http.get<{ data: Projects[] }>(`${this.baseUrl}/items/Projects?fields=*,likes_count`);
  }

  createProjects(ProjectsData: any, token: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/items/Projects`, ProjectsData, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getProjectsByName(name: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/items/Projects/${name}`);
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
    return this.http.post<{ data: { id: string } }>(`${this.baseUrl}/files`, formData);
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



}