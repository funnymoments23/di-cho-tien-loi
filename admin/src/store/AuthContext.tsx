import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../api/auth.api';
import { ApiError, SESSION_EXPIRED_EVENT } from '../api/client';
import type { PublicUser } from '../types';
import {
  clearTokens,
  getAccessToken,
  getStoredUser,
  setStoredUser,
  setTokens,
} from '../utils/tokenStore';

interface AuthContextValue {
  user: PublicUser | null;
  /** Đang kiểm tra phiên đăng nhập lúc mở trang. */
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const clearSession = (): void => {
  clearTokens();
  setStoredUser(null);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() =>
    getAccessToken() ? getStoredUser() : null
  );
  const [initializing, setInitializing] = useState<boolean>(() => Boolean(getAccessToken()));

  // Mở lại trang: xác minh token còn hiệu lực và tài khoản vẫn là admin.
  useEffect(() => {
    if (!getAccessToken()) {
      setInitializing(false);
      return;
    }

    let cancelled = false;

    authApi
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile.role !== 'admin') {
          clearSession();
          setUser(null);
          return;
        }
        setStoredUser(profile);
        setUser(profile);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Client phát sự kiện khi refresh token thất bại hoặc tài khoản bị khoá.
  useEffect(() => {
    const handleExpired = () => {
      setStoredUser(null);
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);

    if (result.user.role !== 'admin') {
      // Đăng nhập thành công nhưng không đủ quyền: thu hồi token rồi báo lỗi.
      setTokens(result.accessToken, result.refreshToken);
      try {
        await authApi.logout();
      } catch {
        // Bỏ qua: đằng nào cũng xoá phiên cục bộ.
      }
      clearSession();
      throw new ApiError('Tài khoản này không có quyền quản trị hệ thống.', '00017', 403);
    }

    setTokens(result.accessToken, result.refreshToken);
    setStoredUser(result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Token có thể đã hết hạn — vẫn phải xoá phiên cục bộ.
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, logout }),
    [user, initializing, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong AuthProvider.');
  return context;
}
