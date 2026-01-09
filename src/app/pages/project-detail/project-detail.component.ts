import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../shared/services/project.service';
import { Projects } from '../../shared/interfaces/project.interface';
import { environment } from '../../../environments/environment';
import { LikeButtonComponent } from '../../shared/components/like-button/like-button.component';
import { CommentSectionComponent } from '../../shared/components/comment-section/comment-section.component';
import { Api } from '../../shared/services/api.service';
import { WebSocketService } from '../../shared/services/websocket.service';
import { LikesService } from '../../shared/services/likes.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LikeButtonComponent, CommentSectionComponent],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css'
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  project: Projects | null = null;
  isLoading = true;
  error = '';
  showShareMenu = false;
  private readonly DIRECTUS_URL = environment.directusUrl;
  private hasPlayedInSession = false;
  private wsSubscription?: Subscription;

  // Lecteur audio
  isPlaying = false;
  currentTime = 0;
  duration = 0;
  private audio: HTMLAudioElement | null = null;

  get currentTimeRounded(): number {
    return Math.floor(this.currentTime);
  }

  get durationRounded(): number {
    return Math.floor(this.duration);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectsService,
    private api: Api,
    private cd: ChangeDetectorRef,
    private elementRef: ElementRef,
    private wsService: WebSocketService,
    private likesService: LikesService
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const shareContainer = document.getElementById('share-menu-container');
    if (this.showShareMenu && shareContainer && !shareContainer.contains(event.target as Node)) {
      this.showShareMenu = false;
    }
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const projectTitle = params['title'];
      if (projectTitle) {
        this.loadProject(projectTitle);
      }
    });

    // Écouter les changements de likes en temps réel
    this.wsService.connect();
    this.wsService.subscribe('Likes');
    
    this.wsSubscription = this.wsService.onCollection('Likes').subscribe((msg) => {
      if (this.project?.id && msg.data) {
        // Vérifier si le like concerne ce projet
        const relevantLike = msg.data.find((like: any) => like.project_id === this.project?.id);
        if (relevantLike) {
          console.log('❤️ Like mis à jour pour ce projet:', msg.event);
          // Recharger le statut du like
          this.likesService.getLikeStatus(this.project.id).subscribe(status => {
            if (this.project) {
              this.project.likes_count = status.total_likes;
              this.cd.detectChanges();
            }
          });
        }
      }
    });
  }

  ngOnDestroy(): void {
    // Nettoyer le lecteur audio
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    // Nettoyer le WebSocket
    this.wsSubscription?.unsubscribe();
    this.wsService.unsubscribe('Likes');
  }

  private loadProject(title: string): void {
    this.isLoading = true;
    this.error = '';
    
    this.projectService.getProjectsByName(title).subscribe({
      next: (response) => {
        if (response && response.data && response.data.length > 0) {
          this.project = response.data[0];
          this.initAudioPlayer();
          this.isLoading = false;
          this.cd.detectChanges();
        } else {
          this.error = 'Projet introuvable';
          this.isLoading = false;
          this.cd.detectChanges();
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement du projet:', error);
        this.error = 'Projet introuvable';
        this.isLoading = false;
        this.cd.detectChanges();
      }
    });
  }

  private initAudioPlayer(): void {
    if (!this.project?.rendered_audio) return;

    const audioUrl = this.getAudioUrl();
    if (!audioUrl) return;

    this.audio = new Audio(audioUrl);

    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio!.duration;
      this.cd.detectChanges();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio!.currentTime;
      this.cd.detectChanges();
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.currentTime = 0;
      this.cd.detectChanges();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Erreur de lecture audio:', e);
    });
  }

  getAudioUrl(): string | null {
    if (!this.project?.rendered_audio) return null;
    return `${this.DIRECTUS_URL}/assets/${this.project.rendered_audio}`;
  }

  downloadAudio(): void {
    if (!this.project?.rendered_audio) return;

    const token = localStorage.getItem('directus_access_token');
    if (!token) {
      alert('Vous devez être connecté pour télécharger');
      return;
    }

    this.incrementDownloads();

    const url = `${this.DIRECTUS_URL}/assets/${this.project.rendered_audio}?download`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.project.title}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  togglePlayPause(): void {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
      // Incrémenter les écoutes seulement au premier play
      this.incrementPlays();
    }
    this.isPlaying = !this.isPlaying;
  }

  private incrementPlays(): void {
    if (!this.project?.id) return;

    const token = localStorage.getItem('directus_access_token');
    
    // Bloquer les invités (utilisateurs non authentifiés)
    if (!token) {
      return;
    }

    // Vérifier le flag local en premier
    if (this.hasPlayedInSession) {
      return;
    }

    // Vérifier d'abord si l'utilisateur a déjà écouté ce projet
    this.api.checkUserPlay(this.project.id).subscribe({
      next: (hasPlayed) => {
        if (hasPlayed) {
          this.hasPlayedInSession = true;
          return; // L'utilisateur a déjà écouté ce projet
        }
        
        // Marquer immédiatement comme joué pour éviter les doubles clics
        this.hasPlayedInSession = true;
        
        // L'utilisateur n'a pas encore écouté, on enregistre le play
        this.api.recordUserPlay(this.project!.id).subscribe({
          next: () => {
            // Puis on incrémente le compteur
            this.api.incrementProjectStats(this.project!.id, 'plays').subscribe({
              next: () => {
                if (this.project) {
                  this.project.plays = (this.project.plays || 0) + 1;
                  this.cd.detectChanges();
                }
              },
              error: (err) => console.error('Erreur lors de l\'incrémentation des écoutes:', err)
            });
          },
          error: (err) => {
            console.error('Erreur lors de l\'enregistrement du play:', err);
            // Réinitialiser le flag en cas d'erreur
            this.hasPlayedInSession = false;
          }
        });
      },
      error: (err) => {
        console.error('Erreur lors de la vérification du play:', err);
        // En cas d'erreur de vérification, on ne fait rien (pas d'incrémentation)
      }
    });
  }

  /**
   * Met à jour le compteur de likes quand l'utilisateur like/unlike
   */
  onLikesChanged(newCount: number): void {
    if (this.project) {
      this.project.likes_count = newCount;
      this.cd.detectChanges();
    }
  }

  downloadUSTFile(): void {
    if (!this.project) return;

    const token = localStorage.getItem('directus_access_token');
    if (!token) {
      alert('Vous devez être connecté pour télécharger');
      return;
    }

    this.incrementDownloads();

    // Récupérer les données de composition depuis le projet
    const projectData = this.project as any;
    const compositionData = projectData.composition_data;

    if (!compositionData) {
      alert('Aucune donnée de composition disponible');
      return;
    }

    // Convertir les données en format JSON
    let notes;
    if (typeof compositionData === 'string') {
      try {
        notes = JSON.parse(compositionData);
      } catch (e) {
        console.error('Erreur lors du parsing de la composition:', e);
        alert('Erreur lors de la lecture des données de composition');
        return;
      }
    } else {
      notes = compositionData;
    }

    // Créer un objet avec toutes les données nécessaires pour réimporter
    const utauData = {
      title: this.project.title,
      description: this.project.description || '',
      tempo: this.project.tempo || 120,
      notes: notes,
      voicebank: projectData.primary_voicebank?.name || '',
      voicebankId: projectData.primary_voicebank?.id || ''
    };

    // Créer le fichier .utau (format JSON)
    const blob = new Blob([JSON.stringify(utauData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Créer un lien de téléchargement et le déclencher
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.project.title}.utau`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private incrementDownloads(): void {
    if (!this.project?.id) return;

    // Pour les téléchargements, on compte chaque fois (pas de limite)
    // Car chaque téléchargement est un engagement réel de l'utilisateur
    this.api.incrementProjectStats(this.project.id, 'downloads').subscribe({
      next: () => {
        if (this.project) {
          this.project.downloads = (this.project.downloads || 0) + 1;
        }
      },
      error: (err) => console.error('Erreur lors de l\'incrémentation des téléchargements:', err)
    });
  }

  seek(event: Event): void {
    if (!this.audio) return;
    const input = event.target as HTMLInputElement;
    const time = parseFloat(input.value);
    this.audio.currentTime = time;
    this.currentTime = time;
  }

  getProgress(): number {
    if (this.duration === 0) return 0;
    return (this.currentTime / this.duration) * 100;
  }

  getCoverImageUrl(): string | null {
    if (!this.project || !this.project.cover_image) return null;
    const coverId = typeof this.project.cover_image === 'string'
      ? this.project.cover_image
      : (this.project.cover_image as any).id;
    return `${this.DIRECTUS_URL}/assets/${coverId}?width=1200&height=630&fit=cover&quality=90`;
  }

  getCreatorName(): string {
    if (!this.project || !this.project.user_created) return 'Anonyme';
    
    if (typeof this.project.user_created === 'object') {
      const user = this.project.user_created as any;
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      if (fullName) return fullName;
      if (user.email) return user.email.split('@')[0];
    }
    
    return 'Anonyme';
  }

  getVoicebankName(): string {
    if (!this.project) return 'N/A';
    
    const project = this.project as any;
    if (!project.primary_voicebank) return 'N/A';
    
    if (typeof project.primary_voicebank === 'object') {
      return project.primary_voicebank.name || 'N/A';
    }
    
    return 'N/A';
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getRelativeTime(date: string): string {
    if (!date) return '';
    
    const now = new Date();
    const projectDate = new Date(date);
    
    // Vérifier si la date est valide
    if (isNaN(projectDate.getTime())) return '';
    
    const diffInSeconds = Math.floor((now.getTime() - projectDate.getTime()) / 1000);

    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} minute(s)`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} heure(s)`;
    if (diffInSeconds < 2592000) return `Il y a ${Math.floor(diffInSeconds / 86400)} jour(s)`;

    return projectDate.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  toggleShareMenu(): void {
    this.showShareMenu = !this.showShareMenu;
  }

  private getShareUrl(): string {
    return window.location.href;
  }

  private getShareText(): string {
    return `Découvrez "${this.project?.title}" sur UTAU Community !`;
  }

  shareOnTwitter(): void {
    const url = encodeURIComponent(this.getShareUrl());
    const text = encodeURIComponent(this.getShareText());
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
    this.showShareMenu = false;
  }

  shareOnFacebook(): void {
    const url = encodeURIComponent(this.getShareUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
    this.showShareMenu = false;
  }

  shareOnWhatsApp(): void {
    const url = encodeURIComponent(this.getShareUrl());
    const text = encodeURIComponent(this.getShareText());
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
    this.showShareMenu = false;
  }

  shareOnTelegram(): void {
    const url = encodeURIComponent(this.getShareUrl());
    const text = encodeURIComponent(this.getShareText());
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    this.showShareMenu = false;
  }

  shareOnDiscord(): void {
    // Discord n'a pas d'API de partage direct, on copie le lien formaté pour Discord
    const text = `${this.getShareText()}\n${this.getShareUrl()}`;
    navigator.clipboard.writeText(text).then(() => {
      alert('Lien copié ! Collez-le dans Discord.');
      this.showShareMenu = false;
    });
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.getShareUrl()).then(() => {
      alert('Lien copié !');
      this.showShareMenu = false;
    });
  }

  shareUrl(): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: this.project?.title || 'Projet UTAU',
        text: `Découvrez ce projet UTAU : ${this.project?.title}`,
        url: url
      }).catch(err => console.log('Erreur partage:', err));
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert('Lien copié dans le presse-papier !');
      });
    }
  }
}
