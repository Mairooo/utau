export interface Projects {
  id: string;
  title: string;
  description?: string;
  likes?: number;
  likes_count?: number; // Nouveau compteur de likes
  plays?: number;
  downloads?: number;
  cover_image?: string;
  rendered_audio?: string; // Fichier audio rendu
  user_created?: { first_name?: string; last_name?: string; email?: string; id?: string } | string;
  status?: string | number;
  date_created?: string;
  date_updated?: string;
  tempo?: number;
  key_signature?: string;
  duration?: number;
  tags?: any[];
}
