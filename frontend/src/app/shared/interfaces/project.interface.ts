export interface Projects {
  id: string;
  title: string;
  description?: string;
  likes?: number;
  likes_count?: number; // Nouveau compteur de likes
  plays?: number;
  cover_image?: string;
  user_created?: { first_name?: string; last_name?: string } | string;
  status?: string | number;
}
