import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Note } from './composition.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AudioRendererService {
  private readonly apiUrl = environment.directusUrl;
  private audioContext: AudioContext | null = null;

  constructor(private http: HttpClient) {}

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Récupère un échantillon audio et le décode
   */
  private async fetchAndDecodeAudio(voicebankName: string, filename: string): Promise<AudioBuffer> {
    const url = `${this.apiUrl}/voicebank-api/${voicebankName}/${filename}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status} lors du chargement de ${filename}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = this.getAudioContext();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Convertit un nom de note (ex: "C4", "D#5") en numéro MIDI
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

  /**
   * Calcule la durée totale de la composition en secondes
   */
  private calculateTotalDuration(notes: Note[], bpm: number): number {
    if (notes.length === 0) return 0;
    
    const maxMeasure = Math.max(...notes.map(n => n.measure + 1));
    const beatsPerSecond = bpm / 60;
    return maxMeasure / beatsPerSecond;
  }

  /**
   * Rend la composition en un seul fichier audio
   */
  async renderComposition(
    notes: Note[],
    voicebankName: string,
    bpm: number,
    phonemeMap: { [key: string]: string }
  ): Promise<Blob> {
    const audioContext = this.getAudioContext();
    const beatsPerSecond = bpm / 60;
    const totalDuration = this.calculateTotalDuration(notes, bpm);
    const sampleRate = audioContext.sampleRate;
    
    // Créer un buffer pour la composition complète
    const offlineContext = new OfflineAudioContext(
      2, // stereo
      Math.ceil(totalDuration * sampleRate),
      sampleRate
    );

    // Grouper les notes par fichier audio pour optimiser le chargement
    const audioBuffers = new Map<string, AudioBuffer>();
    
    // Charger tous les échantillons audio uniques
    const uniquePhonemes = [...new Set(notes.map(n => n.phoneme))];
    
    for (const phoneme of uniquePhonemes) {
      const filename = phonemeMap[phoneme];
      if (filename) {
        const buffer = await this.fetchAndDecodeAudio(voicebankName, filename);
        audioBuffers.set(phoneme, buffer);
      }
    }

    // Planifier chaque note
    for (const note of notes) {
      const audioBuffer = audioBuffers.get(note.phoneme);
      if (!audioBuffer) continue;

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      // Calculer le temps de départ en secondes
      const startTime = note.startTime / beatsPerSecond;

      // Appliquer le pitch shifting (hauteur de la note)
      // On suppose que les samples sont enregistrés en C4 (Do central)
      const referencePitch = 'C4';
      const playbackRate = this.calculatePlaybackRate(referencePitch, note.pitch);
      source.playbackRate.value = playbackRate;

      // Connecter à la destination et démarrer
      source.connect(offlineContext.destination);
      source.start(startTime);
    }

    // Rendre l'audio
    const renderedBuffer = await offlineContext.startRendering();

    // Convertir en WAV
    return this.audioBufferToWav(renderedBuffer);
  }

  /**
   * Convertit un AudioBuffer en fichier WAV (Blob)
   */
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length * buffer.numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // En-tête WAV
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const sampleRate = buffer.sampleRate;
    const numChannels = buffer.numberOfChannels;

    // RIFF identifier
    writeString(0, 'RIFF');
    // file length
    view.setUint32(4, 36 + length, true);
    // RIFF type
    writeString(8, 'WAVE');
    // format chunk identifier
    writeString(12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numChannels * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(36, 'data');
    // data chunk length
    view.setUint32(40, length, true);

    // Écrire les données audio
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}
