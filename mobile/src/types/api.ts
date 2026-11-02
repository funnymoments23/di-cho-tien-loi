export type ApiResponse<T> = {
  code: string;
  message: string;
  data: T;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type User = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatar: string | null;
  gender: string | null;
  birthday: string | null;
  language: 'vi' | 'en';
  timezone: string;
  role: 'user' | 'admin';
  groupId: string | null;
  isVerified: boolean;
};

export type AuthData = {
  user: User;
  accessToken: string;
  refreshToken: string;
};