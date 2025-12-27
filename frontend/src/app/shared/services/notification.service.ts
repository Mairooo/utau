import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
  id: number;
  user_id: string;
  message: string;
  project_id?: string;
  event_type?: string;
  status: 'lu' | 'non_lu';
  triggered_by?: string;
  date_created?: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  unread_count: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly apiUrl = `${environment.directusUrl}/notifications-api`;
  
  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount = signal<number>(0);
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
   * Récupérer toutes les notifications de l'utilisateur
   */
  fetchNotifications(): Observable<NotificationsResponse> {
    this.loading.set(true);
    return this.http.get<NotificationsResponse>(this.apiUrl, { headers: this.getHeaders() })
      .pipe(
        tap(response => {
          this.notifications.set(response.data);
          this.unreadCount.set(response.unread_count);
          this.loading.set(false);
        })
      );
  }

  /**
   * Marquer une notification comme lue
   */
  markAsRead(notificationId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${notificationId}/read`, {}, { headers: this.getHeaders() })
      .pipe(
        tap(() => {
          // Mettre à jour localement
          this.notifications.update(notifs => 
            notifs.map(n => n.id === notificationId ? { ...n, status: 'lu' as const } : n)
          );
          this.unreadCount.update(count => Math.max(0, count - 1));
        })
      );
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  markAllAsRead(): Observable<any> {
    return this.http.patch(`${this.apiUrl}/read-all`, {}, { headers: this.getHeaders() })
      .pipe(
        tap(() => {
          this.notifications.update(notifs => 
            notifs.map(n => ({ ...n, status: 'lu' as const }))
          );
          this.unreadCount.set(0);
        })
      );
  }

  /**
   * Supprimer une notification
   */
  deleteNotification(notificationId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${notificationId}`, { headers: this.getHeaders() })
      .pipe(
        tap(() => {
          const notif = this.notifications().find(n => n.id === notificationId);
          this.notifications.update(notifs => notifs.filter(n => n.id !== notificationId));
          if (notif?.status === 'non_lu') {
            this.unreadCount.update(count => Math.max(0, count - 1));
          }
        })
      );
  }
}
