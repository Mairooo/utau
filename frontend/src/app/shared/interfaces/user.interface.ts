export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  description?: string;
  date_created: string;
  date_updated?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires: number;
  user: User;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}