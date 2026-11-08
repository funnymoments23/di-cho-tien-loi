import { request } from './client';
import type { LoginResult, PublicUser } from '../types';

export const login = (email: string, password: string): Promise<LoginResult> =>
  request<LoginResult>({
    url: '/user/login',
    method: 'POST',
    data: { email, password },
  });

export const logout = (): Promise<null> =>
  request<null>({ url: '/user/logout', method: 'POST' });

export const getProfile = (): Promise<PublicUser> => request<PublicUser>({ url: '/user' });
