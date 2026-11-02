import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthData, User } from '../types/api';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  hydrated: boolean;
  setSession: (data: AuthData) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,

  setSession: async ({ user, accessToken, refreshToken }) => {
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user, accessToken });
  },

  setUser: (user) => {
    SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
    ]);
    set({ user: null, accessToken: null });
  },

  hydrate: async () => {
    const [token, rawUser] = await Promise.all([
      SecureStore.getItemAsync('accessToken'),
      SecureStore.getItemAsync('user'),
    ]);
    set({
      accessToken: token,
      user: rawUser ? (JSON.parse(rawUser) as User) : null,
      hydrated: true,
    });
  },
}));