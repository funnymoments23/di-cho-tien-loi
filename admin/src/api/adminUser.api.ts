import { request } from './client';
import type { AdminUser, Paginated, UserRole } from '../types';

export interface ListUsersParams {
  keyword?: string;
  role?: UserRole;
  status?: 'active' | 'locked';
  isVerified?: boolean;
  groupId?: string;
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'updatedAt' | 'name' | 'email' | 'role';
  order?: 'asc' | 'desc';
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  username?: string;
  avatar?: string;
  gender?: 'male' | 'female' | 'other' | null;
  birthday?: string | null;
  language?: 'vi' | 'en';
  timezone?: string;
  role?: UserRole;
  isVerified?: boolean;
}

export const listUsers = (params: ListUsersParams): Promise<Paginated<AdminUser>> =>
  request<Paginated<AdminUser>>({ url: '/admin/user', params });

export const getUser = (id: string): Promise<AdminUser> =>
  request<AdminUser>({ url: `/admin/user/${id}` });

export const updateUserByAdmin = (
  id: string,
  payload: UpdateUserPayload
): Promise<AdminUser> =>
  request<AdminUser>({ url: `/admin/user/${id}`, method: 'PUT', data: payload });

export const updateUserStatus = (id: string, isActive: boolean): Promise<AdminUser> =>
  request<AdminUser>({
    url: `/admin/user/${id}/status`,
    method: 'PATCH',
    data: { isActive },
  });

export const deleteUserByAdmin = (id: string): Promise<{ id: string }> =>
  request<{ id: string }>({ url: `/admin/user/${id}`, method: 'DELETE' });
