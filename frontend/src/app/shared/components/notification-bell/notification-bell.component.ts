import { Component, OnInit, OnDestroy, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService, Notification } from '../../services/notification.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="relative flex items-center">
      <!-- Bouton cloche -->
      <button 
        (click)="toggleDropdown()"
        class="relative h-9 w-9 flex items-center justify-center rounded-md border border-gray-300 text-sm hover:bg-gray-50 transition-colors">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
        </svg>
        <!-- Badge nombre -->
        <span 
          *ngIf="notificationService.unreadCount() > 0"
          class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {{ notificationService.unreadCount() > 9 ? '9+' : notificationService.unreadCount() }}
        </span>
      </button>

      <!-- Dropdown -->
      <div 
        *ngIf="isOpen()"
        class="absolute top-full right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
        
        <!-- Header -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 class="font-semibold text-gray-900">Notifications</h3>
          <button 
            *ngIf="notificationService.unreadCount() > 0"
            (click)="markAllRead()"
            class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Tout marquer comme lu
          </button>
        </div>

        <!-- Liste -->
        <div class="max-h-96 overflow-y-auto divide-y divide-gray-100">
          <div 
            *ngIf="notificationService.notifications().length === 0"
            class="px-4 py-8 text-center text-gray-500">
            <svg class="w-12 h-12 mx-auto mb-2 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
            </svg>
            <p class="text-sm">Aucune notification</p>
          </div>

          <div 
            *ngFor="let notif of notificationService.notifications()"
            (click)="onNotificationClick(notif)"
            class="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3 group">
            <!-- Icône selon le type -->
            <div [ngClass]="getIconClass(notif.event_type)"
                 class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0">
              <ng-container [ngSwitch]="notif.event_type">
                <!-- Like -->
                <svg *ngSwitchCase="'like'" class="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
                </svg>
                <!-- Comment -->
                <svg *ngSwitchCase="'comment'" class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <!-- Follow -->
                <svg *ngSwitchCase="'follow'" class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
                </svg>
                <!-- Nouveau projet -->
                <svg *ngSwitchCase="'new_project'" class="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.369 4.369 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
                </svg>
                <!-- Défaut -->
                <svg *ngSwitchDefault class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/>
                </svg>
              </ng-container>
            </div>
            <!-- Contenu -->
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900" [class.font-medium]="notif.status === 'non_lu'">{{ notif.message }}</p>
              <p class="text-xs text-gray-400 mt-1">
                {{ formatDate(notif.date_created) }}
              </p>
            </div>
            <!-- Bouton supprimer (visible au hover) -->
            <button 
              (click)="deleteNotif($event, notif)"
              class="text-gray-300 hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  readonly isOpen = signal(false);
  private pollingSubscription?: Subscription;
  private readonly POLL_INTERVAL = 10000; // 10 secondes

  constructor(
    public notificationService: NotificationService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    // Polling pour rafraîchir les notifications
    this.pollingSubscription = interval(this.POLL_INTERVAL).subscribe(() => {
      this.loadNotifications();
    });
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }

  loadNotifications(): void {
    this.notificationService.fetchNotifications().subscribe({
      error: (err) => console.error('Erreur chargement notifications:', err)
    });
  }

  toggleDropdown(): void {
    this.isOpen.update(v => !v);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      error: (err) => console.error('Erreur marquage lu:', err)
    });
  }

  onNotificationClick(notif: Notification): void {
    if (notif.status === 'non_lu') {
      this.notificationService.markAsRead(notif.id).subscribe();
    }
    // Optionnel: naviguer vers le projet
    // if (notif.project_id) {
    //   this.router.navigate(['/project', notif.project_id]);
    // }
  }

  deleteNotif(event: Event, notif: Notification): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(notif.id).subscribe({
      error: (err) => console.error('Erreur suppression:', err)
    });
  }

  getIconClass(eventType?: string): string {
    switch (eventType) {
      case 'like':
        return 'bg-pink-100';
      case 'comment':
        return 'bg-gray-100';
      case 'follow':
        return 'bg-green-100';
      case 'new_project':
        return 'bg-pink-100';
      default:
        return 'bg-gray-200';
    }
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  }
}
