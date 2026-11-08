import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_URL } from '../config/env';
import type { ApiResponse } from '../types';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../utils/tokenStore';

/** Lỗi API mang theo mã lỗi 5 chữ số của backend và HTTP status. */
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = '', status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Sự kiện phát ra khi phiên đăng nhập không thể khôi phục. */
export const SESSION_EXPIRED_EVENT = 'admin:session-expired';
export const SESSION_EXPIRED_FLAG = 'admin.sessionExpired';

const DEFAULT_NETWORK_ERROR =
  'Không kết nối được tới máy chủ. Kiểm tra server đang chạy và VITE_API_URL.';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

/** Gọi refresh-token bằng axios gốc để không đi qua interceptor (tránh vòng lặp). */
async function refreshTokens(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${API_URL}/user/refresh-token`,
      { refreshToken },
      { timeout: 20_000 }
    );
    const tokens = res.data.data;
    setTokens(tokens.accessToken, tokens.refreshToken); // rotate: phải lưu token mới
    return tokens.accessToken;
  } catch {
    return null;
  }
}

function notifySessionExpired(): void {
  clearTokens();
  sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1');
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const code = error.response?.data?.code;

    // Access token hết hạn (00011) hoặc không hợp lệ (00012): thử refresh một lần.
    if (original && !original._retry && (code === '00011' || code === '00012')) {
      original._retry = true;
      refreshing ??= refreshTokens().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
      notifySessionExpired();
    }

    // Phiên không còn dùng được: thiếu/hỏng token, bị hạ quyền, bị khoá hoặc đã bị xoá.
    if (['00006', '00017', '00052', '00403'].includes(code ?? '')) notifySessionExpired();

    const body = error.response?.data;
    throw new ApiError(
      body?.message ?? DEFAULT_NETWORK_ERROR,
      body?.code ?? '',
      error.response?.status ?? 0
    );
  }
);

/** Gọi API và trả về `data` trong khuôn response thống nhất. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<ApiResponse<T>>(config);
  return res.data.data;
}
