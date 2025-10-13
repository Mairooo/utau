import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VoicebankService, Voicebank } from '../../shared/services/voicebank.service';
import { CompositionService, ProjectData } from '../../shared/services/composition.service';
import { Note, PHONEME_MAP, PITCH_LIST } from '../../shared/models/composer.model';

@Component({
  selector: 'app-composer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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

  constructor(
    private voicebankService: VoicebankService,
    private compositionService: CompositionService
  ) {}

  ngOnInit(): void {
    this.loadVoicebanks();
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
          console.log('Playing preview:', filename);
          this.voicebankService.playAudio(this.selectedVoicebank()!.name, filename);
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
          console.log('Playing:', filename, 'for voicebank:', this.selectedVoicebank()!.name);
          this.voicebankService.playAudio(this.selectedVoicebank()!.name, filename);
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

  saveProject(): void {
    const title = this.saveTitle().trim();
    if (!title) {
      alert('Veuillez donner un titre au projet');
      return;
    }

    if (!this.selectedVoicebank()) {
      alert('Veuillez sélectionner une voicebank');
      return;
    }

    console.log('Saving project with voicebank ID:', this.selectedVoicebank()!.id);
    console.log('Notes to save:', this.notes());

    this.compositionService.saveComposition(
      this.currentProjectId(),
      {
        title: title,
        description: this.saveDescription(),
        tempo: this.bpm(),
        voicebankId: this.selectedVoicebank()!.id,
        notes: this.notes()
      }
    ).subscribe({
      next: (project) => {
        console.log('Project saved successfully:', project);
        this.currentProjectId.set(project.id);
        this.projectTitle.set(project.title);
        this.projectDescription.set(project.description || '');
        this.closeSaveDialog();
        alert('✅ Projet sauvegardé avec succès !');
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

  loadProject(project: ProjectData): void {
    this.currentProjectId.set(project.id);
    this.projectTitle.set(project.title);
    this.projectDescription.set(project.description || '');
    this.bpm.set(project.tempo);
    
    // Charger les notes
    const notes = this.compositionService.loadCompositionNotes(project);
    this.notes.set(notes);

    // Trouver et sélectionner la voicebank
    if (project.primary_voicebank) {
      const voicebankId = typeof project.primary_voicebank === 'string' 
        ? project.primary_voicebank 
        : (project.primary_voicebank as any).id;
      
      const voicebank = this.voicebanks().find(v => v.id === voicebankId);
      if (voicebank) {
        this.onSelectVoicebank(voicebank);
      }
    }

    this.closeLoadDialog();
    alert('✅ Projet chargé avec succès !');
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
  }

  exportProject(): void {
    if (!this.currentProjectId()) {
      alert('Veuillez d\'abord sauvegarder le projet');
      return;
    }

    this.compositionService.getProject(this.currentProjectId()!).subscribe({
      next: (project) => {
        this.compositionService.exportProject(project);
      },
      error: (err) => {
        console.error('Error exporting project:', err);
        alert('❌ Erreur lors de l\'export');
      }
    });
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


