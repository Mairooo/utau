export interface Note {
  id: string;
  pitch: string;
  phoneme: string;
  startTime: number;
  duration: number;
  measure: number;
  position: number;
}

export interface ComposerTrack {
  id: string;
  name: string;
  notes: Note[];
  voicebankName?: string;
}

export const PHONEME_MAP: { [key: string]: string } = {
  'a': '_あ.wav',
  'i': '_い.wav',
  'u': '_う.wav',
  'e': '_え.wav',
  'o': '_お.wav',
  'ka': '_か.wav',
  'ki': '_き.wav',
  'ku': '_く.wav',
  'ke': '_け.wav',
  'ko': '_こ.wav',
  'sa': '_さ.wav',
  'shi': '_し.wav',
  'su': '_す.wav',
  'se': '_せ.wav',
  'so': '_そ.wav',
  'ta': '_た.wav',
  'chi': '_ち.wav',
  'tsu': '_つ.wav',
  'te': '_て.wav',
  'to': '_と.wav',
  'na': '_な.wav',
  'ni': '_に.wav',
  'nu': '_ぬ.wav',
  'ne': '_ね.wav',
  'no': '_の.wav',
  'ha': '_は.wav',
  'hi': '_ひ.wav',
  'fu': '_ふ.wav',
  'he': '_へ.wav',
  'ho': '_ほ.wav',
  'ma': '_ま.wav',
  'mi': '_み.wav',
  'mu': '_む.wav',
  'me': '_め.wav',
  'mo': '_も.wav',
  'ya': '_や.wav',
  'yu': '_ゆ.wav',
  'yo': '_よ.wav',
  'ra': '_ら.wav',
  'ri': '_り.wav',
  'ru': '_る.wav',
  're': '_れ.wav',
  'ro': '_ろ.wav',
  'wa': '_わ.wav',
  'wo': '_を.wav',
  'n': '_ん.wav'
};

// Liste des notes du plus aigu au plus grave (pour affichage piano roll)
// Ordre chromatique: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
export const PITCH_LIST = [
  // Octave 5
  'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5',
  // Octave 4 (contient C4 = Middle C)
  'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4',
  // Octave 3
  'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3'
];
