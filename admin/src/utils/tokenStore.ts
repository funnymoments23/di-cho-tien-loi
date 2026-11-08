import type { PublicUser } from '../types';

const ACCESS_KEY = 'dctl.admin.accessToken';
const REFRESH_KEY = 'dctl.admin.refreshToken';
const USER_KEY = 'dctl.admin.user';

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_KEY);

export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);

export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

/** Lưu tài khoản đang đăng nhập để lần mở sau hiển thị ngay, trước khi gọi /user. */
export const getStoredUser = (): PublicUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const setStoredUser = (user: PublicUser | null): void => {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};
