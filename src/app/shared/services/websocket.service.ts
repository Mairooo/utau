import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface WebSocketMessage {
  type: string;
  uid?: string;
  event?: 'init' | 'create' | 'update' | 'delete';
  data?: any[];
  collection?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private subscriptions: Map<string, { uid: string; query?: any }> = new Map();
  private isAuthenticated = false;
  private pendingSubscriptions: Array<{ collection: string; query?: any }> = [];

  /**
   * Observable des messages reçus
   */
  get messages$(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * Observable filtré pour une collection spécifique
   */
  onCollection(collection: string): Observable<WebSocketMessage> {
    return this.messages$.pipe(
      filter(msg => {
        const uid = this.subscriptions.get(collection)?.uid;
        return msg.uid === uid || msg.collection === collection;
      })
    );
  }

  /**
   * Observable pour les événements de création
   */
  onCreate(collection: string): Observable<any[]> {
    return new Observable(observer => {
      const sub = this.onCollection(collection).pipe(
        filter(msg => msg.event === 'create')
      ).subscribe(msg => {
        observer.next(msg.data || []);
      });
      return () => sub.unsubscribe();
    });
  }

  /**
   * Observable pour les événements de mise à jour
   */
  onUpdate(collection: string): Observable<any[]> {
    return new Observable(observer => {
      const sub = this.onCollection(collection).pipe(
        filter(msg => msg.event === 'update')
      ).subscribe(msg => {
        observer.next(msg.data || []);
      });
      return () => sub.unsubscribe();
    });
  }

  /**
   * Observable pour les événements de suppression
   */
  onDelete(collection: string): Observable<any[]> {
    return new Observable(observer => {
      const sub = this.onCollection(collection).pipe(
        filter(msg => msg.event === 'delete')
      ).subscribe(msg => {
        observer.next(msg.data || []);
      });
      return () => sub.unsubscribe();
    });
  }

  /**
   * Connecter au WebSocket Directus
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return; // Déjà connecté
    }

    const wsUrl = environment.directusUrl.replace('http', 'ws') + '/websocket';
    
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('🔌 WebSocket Directus connecté');
        this.reconnectAttempts = 0;
        this.authenticate();
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (e) {
          console.error('Erreur parsing WebSocket message:', e);
        }
      };

      this.socket.onclose = (event) => {
        console.log('🔌 WebSocket fermé:', event.code, event.reason);
        this.isAuthenticated = false;
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('❌ WebSocket erreur:', error);
      };
    } catch (error) {
      console.error('Erreur création WebSocket:', error);
    }
  }

  /**
   * Authentifier la connexion WebSocket
   */
  private authenticate(): void {
    const token = localStorage.getItem('directus_access_token');
    if (token && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'auth',
        access_token: token
      }));
    }
  }

  /**
   * Gérer les messages entrants
   */
  private handleMessage(message: any): void {
    if (message.type === 'auth' && message.status === 'ok') {
      console.log('✅ WebSocket authentifié');
      this.isAuthenticated = true;
      // Traiter les subscriptions en attente
      this.processPendingSubscriptions();
      // Réabonner aux collections après reconnexion
      this.resubscribeAll();
    } else if (message.type === 'subscription') {
      // Message de données de subscription
      this.messageSubject.next(message);
    }
  }

  /**
   * Traiter les subscriptions en attente
   */
  private processPendingSubscriptions(): void {
    while (this.pendingSubscriptions.length > 0) {
      const pending = this.pendingSubscriptions.shift();
      if (pending) {
        this.subscribe(pending.collection, pending.query);
      }
    }
  }

  /**
   * S'abonner aux changements d'une collection
   */
  subscribe(collection: string, query?: any): void {
    if (!this.isAuthenticated) {
      // Mettre en file d'attente si pas encore authentifié
      this.pendingSubscriptions.push({ collection, query });
      return;
    }

    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket non connecté, impossible de s\'abonner');
      return;
    }

    // Éviter les doublons
    if (this.subscriptions.has(collection)) {
      return;
    }

    const uid = `${collection}-${Date.now()}`;
    
    const subscribeMessage: any = {
      type: 'subscribe',
      collection: collection,
      uid: uid
    };

    if (query) {
      subscribeMessage.query = query;
    }

    this.socket.send(JSON.stringify(subscribeMessage));
    this.subscriptions.set(collection, { uid, query });
    console.log(`📡 Abonné à la collection: ${collection}`);
  }

  /**
   * Se désabonner d'une collection
   */
  unsubscribe(collection: string): void {
    const sub = this.subscriptions.get(collection);
    if (!sub || this.socket?.readyState !== WebSocket.OPEN) return;

    this.socket.send(JSON.stringify({
      type: 'unsubscribe',
      uid: sub.uid
    }));

    this.subscriptions.delete(collection);
    console.log(`📡 Désabonné de la collection: ${collection}`);
  }

  /**
   * Réabonner à toutes les collections après reconnexion
   */
  private resubscribeAll(): void {
    const subs = Array.from(this.subscriptions.entries());
    this.subscriptions.clear();
    
    subs.forEach(([collection, { query }]) => {
      this.subscribe(collection, query);
    });
  }

  /**
   * Tentative de reconnexion automatique
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Nombre max de tentatives de reconnexion atteint');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Vérifier si connecté
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  /**
   * Déconnecter le WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.isAuthenticated = false;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messageSubject.complete();
  }
}
