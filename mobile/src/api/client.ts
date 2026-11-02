import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/env';
import type { ApiResponse } from '../types/api';

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = '', status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const api = axios.create({ baseURL: API_URL, timeout: 15_000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshTokens(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    // Dùng axios gốc để không đi qua interceptor, tránh vòng lặp vô hạn
    const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${API_URL}/user/refresh-token`,
      { refreshToken }
    );
    const tokens = res.data.data;
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken); // rotate: phải lưu token mới
    return tokens.accessToken;
  } catch {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiResponse<null>>) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const code = error.response?.data?.code;

    if (original && !original._retry && (code === '00011' || code === '00012')) {
      original._retry = true;
      refreshing ??= refreshTokens().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
    }

    const body = error.response?.data;
    throw new ApiError(
      body?.message ?? 'Không kết nối được máy chủ. Vui lòng thử lại.',
      body?.code ?? '',
      error.response?.status ?? 0
    );
  }
);

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<ApiResponse<T>>(config);
  return res.data.data;
}