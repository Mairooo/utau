import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VoicebankService, Voicebank } from '../../shared/services/voicebank.service';
import { CompositionService, ProjectData } from '../../shared/services/composition.service';
import { Note, PHONEME_MAP, PITCH_LIST } from '../../shared/models/composer.model';
import { AudioRendererService } from '../../shared/services/audio-renderer.service';
import { Api } from '../../shared/services/api.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';

@Component({
  selector: 'app-composer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NotificationBellComponent],
  templateUrl: './composer.component.html',
  styleUrls: ['./composer.component.css']
})
export class ComposerComponent implements OnInit {
  readonly projectTitle = signal('Nouvelle Composition');
  readonly projectDescription = signal('');
  readonly bpm = signal(120);
  readonly isPlaying = signal(false);
  readonly timePosition = signal(0);
  readonly measures = signal(8);
  readonly notes = signal<Note[]>([]);
  readonly notesCount = computed(() => this.notes().length);
  
  readonly voicebanks = signal<Voicebank[]>([]);
  readonly selectedVoicebank = signal<Voicebank | null>(null);
  readonly projectVoicebank = signal<Voicebank | null>(null); // Voicebank fixée au projet
  readonly isProjectSaved = signal(false); // Indique si le projet est sauvegardé
  readonly selectedPhoneme = signal<string>('a');
  readonly pitchList = PITCH_LIST;
  readonly phonemeList = Object.keys(PHONEME_MAP);

  // Gestion des projets
  readonly projects = signal<ProjectData[]>([]);
  readonly currentProjectId = signal<string | undefined>(undefined);
  readonly showSaveDialog = signal(false);
  readonly showLoadDialog = signal(false);
  readonly saveTitle = signal('');
  readonly saveDescription = signal('');

  private playTimer: any = null;
  private playingNotes = new Set<string>();

  // Signal pour l'état du rendu audio
  readonly rendering = signal(false);

  constructor(
    private voicebankService: VoicebankService,
    private compositionService: CompositionService,
    private audioRenderer: AudioRendererService,
    private api: Api,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Charger le projet si un projectId est passé en query params
    this.route.queryParams.subscribe(params => {
      const projectId = params['projectId'];
      if (projectId) {
        // Attendre que les voicebanks soient chargées avant de charger le projet
        this.voicebankService.getVoicebanks().subscribe({
          next: (banks) => {
            this.voicebanks.set(banks);
            if (banks.length > 0 && !this.selectedVoicebank()) {
              this.onSelectVoicebank(banks[0]);
            }
            // Maintenant charger le projet
            this.loadProjectById(projectId);
          },
          error: (err) => console.error('Error loading voicebanks:', err)
        });
      } else {
        // Chargement normal des voicebanks si pas de projet à charger
        this.loadVoicebanks();
      }
    });
  }

  loadVoicebanks(): void {
    this.voicebankService.getVoicebanks().subscribe({
      next: (banks) => {
        this.voicebanks.set(banks);
        if (banks.length > 0) {
          this.onSelectVoicebank(banks[0]);
        }
      },
      error: (err) => console.error('Error loading voicebanks:', err)
    });
  }

  onSelectVoicebank(voicebank: Voicebank): void {
    this.selectedVoicebank.set(voicebank);
    this.voicebankService.selectVoicebank(voicebank);
  }

  onSelectPhoneme(phoneme: string): void {
    this.selectedPhoneme.set(phoneme);
  }

  onCellClick(pitch: string, measure: number, position: number): void {
    const existingNote = this.notes().find(
      n => n.pitch === pitch && n.measure === measure && n.position === position
    );

    if (existingNote) {
      this.notes.update(notes => notes.filter(n => n.id !== existingNote.id));
    } else {
      const newNote: Note = {
        id: `${Date.now()}-${Math.random()}`,
        pitch,
        phoneme: this.selectedPhoneme(),
        startTime: measure,
        duration: 1,
        measure,
        position
      };
      this.notes.update(notes => [...notes, newNote]);

      if (this.selectedVoicebank()) {
        const filename = PHONEME_MAP[this.selectedPhoneme()];
        if (filename) {
          console.log('Playing preview:', filename, 'at pitch:', pitch);
          this.voicebankService.playAudio(this.selectedVoicebank()!.name, filename, pitch);
        }
      }
    }
  }

  getNoteAt(pitch: string, measure: number): Note | undefined {
    return this.notes().find(n => n.pitch === pitch && n.measure === measure);
  }

  onTitleInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (input) this.projectTitle.set(input.value);
  }

  onTogglePlay(): void {
    const next = !this.isPlaying();
    this.isPlaying.set(next);
    if (next) {
      this.startTicker();
      this.playNotes();
    } else {
      this.stopTicker();
      this.voicebankService.stopAllAudio();
    }
  }

  onStop(): void {
    this.isPlaying.set(false);
    this.stopTicker();
    this.timePosition.set(0);
    this.voicebankService.stopAllAudio();
    this.playingNotes.clear();
  }

  private playNotes(): void {
    const currentTime = this.timePosition();
    console.log('Current time:', currentTime, 'Notes:', this.notes().length);
    
    const notesToPlay = this.notes().filter(note => {
      const noteKey = note.id;
      const isInTimeRange = Math.floor(note.startTime) === Math.floor(currentTime);
      const notAlreadyPlaying = !this.playingNotes.has(noteKey);
      
      if (isInTimeRange && notAlreadyPlaying) {
        console.log('Should play note:', note.phoneme, 'at measure', note.measure);
      }
      
      return isInTimeRange && notAlreadyPlaying;
    });

    notesToPlay.forEach(note => {
      if (this.selectedVoicebank()) {
        const filename = PHONEME_MAP[note.phoneme];
        if (filename) {
          console.log('Playing:', filename, 'at pitch:', note.pitch, 'for voicebank:', this.selectedVoicebank()!.name);
          this.voicebankService.playAudio(this.selectedVoicebank()!.name, filename, note.pitch);
          this.playingNotes.add(note.id);
          
          setTimeout(() => {
            this.playingNotes.delete(note.id);
          }, note.duration * 1000);
        }
      }
    });
  }

  onInitPosition(): void {
    this.timePosition.set(0);
  }

  onChangeBpm(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const val = Number(input?.value ?? '');
    if (!Number.isNaN(val)) this.bpm.set(val);
  }

  onChangeMeasures(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const val = Number(input?.value ?? '');
    if (!Number.isNaN(val) && val >= 4 && val <= 64) {
      this.measures.set(val);
    }
  }

  private startTicker(): void {
    this.stopTicker();
    const beatsPerSecond = this.bpm() / 60;
    const intervalMs = 1000 / beatsPerSecond;
    
    console.log('Starting playback - BPM:', this.bpm(), 'Interval:', intervalMs);
    
    this.playTimer = setInterval(() => {
      this.timePosition.update((t) => {
        const newTime = t + 1;
        console.log('Tick - Time:', newTime);
        
        if (newTime >= this.measures()) {
          console.log('End of composition');
          this.onStop();
          return 0;
        }
        return newTime;
      });
      
      if (this.isPlaying()) {
        this.playNotes();
      }
    }, intervalMs);
  }

  private stopTicker(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  // === GESTION DES PROJETS ===

  openSaveDialog(): void {
    this.saveTitle.set(this.projectTitle());
    this.saveDescription.set(this.projectDescription());
    this.showSaveDialog.set(true);
  }

  closeSaveDialog(): void {
    this.showSaveDialog.set(false);
  }

  async saveProject(): Promise<void> {
    // Si un projet est déjà chargé, utiliser ses valeurs
    // Sinon, utiliser les valeurs de la dialog
    const title = this.currentProjectId() 
      ? this.projectTitle().trim() 
      : this.saveTitle().trim();
    
    const description = this.currentProjectId()
      ? this.projectDescription()
      : this.saveDescription();
    
    if (!title) {
      alert('Veuillez donner un titre au projet');
      return;
    }

    if (!this.selectedVoicebank()) {
      alert('Veuillez sélectionner une voicebank');
      return;
    }

    // Vérifier que l'utilisateur est authentifié
    const token = localStorage.getItem('directus_access_token');
    if (!token) {
      alert('Vous devez être connecté pour sauvegarder un projet');
      return;
    }

    // Générer l'audio si des notes existent
    let audioFileId: string | undefined;
    if (this.notes().length > 0) {
      try {
        this.rendering.set(true);
        
        const audioBlob = await this.audioRenderer.renderComposition(
          this.notes(),
          this.selectedVoicebank()!.name,
          this.bpm(),
          PHONEME_MAP
        );
        
        if (audioBlob.size === 0) {
          throw new Error('Le fichier audio généré est vide');
        }
        
        // Créer un fichier à partir du Blob
        const audioFile = new File([audioBlob], `${title}.wav`, { type: 'audio/wav' });
        
        // Uploader le fichier
        const uploadResult = await this.api.uploadFile(audioFile).toPromise();
        audioFileId = uploadResult?.data?.id;
        
        if (!audioFileId) {
          throw new Error('L\'upload n\'a pas retourné d\'ID');
        }
      } catch (error) {
        console.error('Erreur lors de la génération de l\'audio:', error);
        
        let errorMessage = 'Erreur inconnue';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          errorMessage = JSON.stringify(error);
        }
        
        alert(`⚠️ Erreur audio: ${errorMessage}\nLe projet sera sauvegardé sans audio.`);
        // Continuer la sauvegarde même si l'audio échoue
      } finally {
        this.rendering.set(false);
      }
    }

    this.compositionService.saveComposition(
      this.currentProjectId(),
      {
        title: title,
        description: description,
        tempo: this.bpm(),
        voicebankId: this.selectedVoicebank()!.id,
        notes: this.notes(),
        audioFileId: audioFileId
      }
    ).subscribe({
      next: (project) => {
        console.log('Project saved successfully:', project);
        this.currentProjectId.set(project.id);
        this.projectTitle.set(project.title);
        this.projectDescription.set(project.description || '');
        this.isProjectSaved.set(true); // Marquer le projet comme sauvegardé
        this.projectVoicebank.set(this.selectedVoicebank()); // Fixer la voicebank au projet
        this.closeSaveDialog();
        
        // Rediriger vers le profil après la sauvegarde
        this.router.navigate(['/profile']);
      },
      error: (err) => {
        console.error('Error saving project:', err);
        console.error('Error details:', err.error);
        alert(`❌ Erreur lors de la sauvegarde du projet: ${err.error?.errors?.[0]?.message || err.message}`);
      }
    });
  }

  openLoadDialog(): void {
    this.showLoadDialog.set(true);
    this.loadProjects();
  }

  closeLoadDialog(): void {
    this.showLoadDialog.set(false);
  }

  loadProjects(): void {
    this.compositionService.getMyProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        alert('❌ Erreur lors du chargement des projets');
      }
    });
  }

  loadProjectById(projectId: string): void {
    console.log('Loading project with ID:', projectId);
    this.compositionService.getProject(projectId).subscribe({
      next: (project) => {
        console.log('Project loaded successfully:', project);
        this.loadProject(project, false); // Ne pas afficher l'alerte quand c'est depuis queryParams
      },
      error: (err) => {
        console.error('Error loading project:', err);
        console.error('Error details:', err.error, err.message, err.status);
        alert(`❌ Erreur lors du chargement du projet: ${err.error?.errors?.[0]?.message || err.message || 'Erreur inconnue'}`);
      }
    });
  }

  loadProject(project: ProjectData, showAlert: boolean = true): void {
    console.log('Loading project into composer:', project);
    
    this.currentProjectId.set(project.id);
    this.projectTitle.set(project.title);
    this.projectDescription.set(project.description || '');
    this.bpm.set(project.tempo);
    this.isProjectSaved.set(true); // Le projet est sauvegardé
    
    // Charger les notes
    console.log('Composition data:', project.composition_data);
    const notes = this.compositionService.loadCompositionNotes(project);
    console.log('Loaded notes:', notes);
    console.log('Number of notes:', notes.length);
    this.notes.set(notes);

    // Trouver et fixer la voicebank
    if (project.primary_voicebank) {
      const voicebankId = typeof project.primary_voicebank === 'string' 
        ? project.primary_voicebank 
        : (project.primary_voicebank as any).id;
      
      const voicebank = this.voicebanks().find(v => v.id === voicebankId);
      if (voicebank) {
        this.onSelectVoicebank(voicebank);
        this.projectVoicebank.set(voicebank); // Fixer la voicebank au projet
      }
    }

    this.closeLoadDialog();
    if (showAlert) {
      alert('✅ Projet chargé avec succès !');
    }
  }

  deleteProject(project: ProjectData, event: Event): void {
    event.stopPropagation();
    
    if (!confirm(`Voulez-vous vraiment supprimer "${project.title}" ?`)) {
      return;
    }

    if (!project.id) return;

    this.compositionService.deleteProject(project.id).subscribe({
      next: () => {
        // Retirer le projet de la liste
        this.projects.update(projects => projects.filter(p => p.id !== project.id));
        
        // Si c'est le projet en cours, réinitialiser
        if (this.currentProjectId() === project.id) {
          this.newProject();
        }
        
        alert('✅ Projet supprimé');
      },
      error: (err) => {
        console.error('Error deleting project:', err);
        alert('❌ Erreur lors de la suppression');
      }
    });
  }

  newProject(): void {
    if (this.notes().length > 0) {
      if (!confirm('Voulez-vous vraiment créer un nouveau projet ? Les modifications non sauvegardées seront perdues.')) {
        return;
      }
    }

    this.currentProjectId.set(undefined);
    this.projectTitle.set('Nouvelle Composition');
    this.projectDescription.set('');
    this.notes.set([]);
    this.timePosition.set(0);
    this.bpm.set(120);
    this.isProjectSaved.set(false); // Nouveau projet non sauvegardé
    this.projectVoicebank.set(null); // Pas de voicebank fixée
  }

  exportProject(): void {
    // Exporter la composition actuelle même si elle n'est pas sauvegardée
    const exportData = {
      title: this.projectTitle() || 'Composition sans titre',
      description: this.projectDescription() || '',
      tempo: this.bpm(),
      voicebank: this.selectedVoicebank()?.name || '',
      voicebankId: this.selectedVoicebank()?.id || '',
      notes: this.notes(),
      exported_at: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportData.title}.utau`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  onFileImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.compositionService.importProject(file).then(
      (data) => {
        this.projectTitle.set(data.title || 'Projet importé');
        this.projectDescription.set(data.description || '');
        this.bpm.set(data.tempo || 120);
        this.notes.set(data.notes || []);

        // Trouver la voicebank si possible
        if (data.voicebank) {
          const voicebank = this.voicebanks().find(v => 
            v.id === data.voicebank || v.name === data.voicebank
          );
          if (voicebank) {
            this.onSelectVoicebank(voicebank);
          }
        }

        alert('✅ Projet importé avec succès !');
      },
      (error) => {
        console.error('Error importing project:', error);
        alert('❌ Erreur lors de l\'importation du fichier');
      }
    );

    // Reset input
    input.value = '';
  }

  // Helper pour obtenir le nom de la voicebank
  getVoicebankName(voicebank: any): string {
    if (!voicebank) return 'N/A';
    if (typeof voicebank === 'string') return voicebank;
    return voicebank.name || 'N/A';
  }

  // Helper pour charger les notes d'un projet
  getProjectNotes(project: ProjectData): number {
    return this.compositionService.loadCompositionNotes(project).length;
  }
}


