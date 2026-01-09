import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Voicebank {
  id: string;
  name: string;
  description?: string;
  language?: string;
  author?: string;
}

export interface VoicebankFile {
  name: string;
  path: string;
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class VoicebankService {
  private readonly apiUrl = 'http://localhost:8055';
  private audioCache = new Map<string, HTMLAudioElement>();
  
  readonly selectedVoicebank = signal<Voicebank | null>(null);
  readonly availableFiles = signal<VoicebankFile[]>([]);

  constructor(private http: HttpClient) {}

  getVoicebanks(): Observable<Voicebank[]> {
    return this.http.get<any>(`${this.apiUrl}/items/voicebanks`).pipe(
      map(response => response.data || [])
    );
  }

  selectVoicebank(voicebank: Voicebank): void {
    this.selectedVoicebank.set(voicebank);
    this.loadVoicebankFiles(voicebank.name);
  }

  private loadVoicebankFiles(voicebankName: string): void {
    this.http.get<any>(`${this.apiUrl}/voicebank-api/${encodeURIComponent(voicebankName)}`)
      .subscribe({
        next: (response) => {
          this.availableFiles.set(response.files || []);
        },
        error: (err) => {
          console.error('Error loading voicebank files:', err);
          this.availableFiles.set([]);
        }
      });
  }

  getAudioUrl(voicebankName: string, filename: string): string {
    return `${this.apiUrl}/voicebank-api/${encodeURIComponent(voicebankName)}/${encodeURIComponent(filename)}`;
  }

  /**
   * Convertit un nom de note en numéro MIDI
   * Note: C4 (Middle C) = MIDI 60 (norme internationale)
   */
  private noteToMidi(noteName: string): number {
    const noteMap: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    
    const match = noteName.match(/^([A-G]#?)(\d)$/);
    if (!match) return 60; // C4 par défaut
    
    const [, note, octave] = match;
    const noteNum = noteMap[note] ?? 0;
    const octaveNum = parseInt(octave, 10);
    
    // Formule MIDI standard : (octave + 1) * 12 + note
    // C-1 = 0, C0 = 12, C1 = 24, ..., C4 = 60
    return (octaveNum + 1) * 12 + noteNum;
  }

  /**
   * Calcule le ratio de playback pour changer la hauteur d'une note
   */
  private calculatePlaybackRate(fromNote: string, toNote: string): number {
    const fromMidi = this.noteToMidi(fromNote);
    const toMidi = this.noteToMidi(toNote);
    const semitoneDiff = toMidi - fromMidi;
    
    // Formule pour le pitch shifting : 2^(n/12) où n = nombre de demi-tons
    return Math.pow(2, semitoneDiff / 12);
  }

  async playAudio(voicebankName: string, filename: string, pitch?: string): Promise<void> {
    const cacheKey = `${voicebankName}:${filename}`;
    
    let audio = this.audioCache.get(cacheKey);
    
    if (!audio) {
      const url = this.getAudioUrl(voicebankName, filename);
      console.log('Creating new audio element for:', url);
      audio = new Audio(url);
      this.audioCache.set(cacheKey, audio);
      
      audio.addEventListener('error', (e) => {
        console.error('Audio error for', filename, ':', e);
      });
      
      audio.addEventListener('loadeddata', () => {
        console.log('Audio loaded:', filename);
      });
    }

    try {
      audio.currentTime = 0;
      
      // Appliquer le pitch shifting si un pitch est fourni
      if (pitch) {
        const referencePitch = 'C4'; // La note de référence des samples
        const playbackRate = this.calculatePlaybackRate(referencePitch, pitch);
        audio.playbackRate = playbackRate;
        audio.preservesPitch = false; // Important pour que le pitch change vraiment
        console.log('Playing audio:', filename, 'at pitch:', pitch, 'rate:', playbackRate);
      } else {
        audio.playbackRate = 1.0;
        console.log('Playing audio:', filename, 'at normal rate');
      }
      
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', filename, error);
    }
  }

  stopAllAudio(): void {
    this.audioCache.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  clearCache(): void {
    this.stopAllAudio();
    this.audioCache.clear();
  }
}
