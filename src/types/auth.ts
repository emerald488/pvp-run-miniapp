export interface TelegramUser {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface AuthState {
  token: string | null;
  user: TelegramUser | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthResponse {
  token: string;
  user: TelegramUser;
}
