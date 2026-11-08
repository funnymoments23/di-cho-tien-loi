import { request } from './client';
import type { Lookup } from '../types';

export const listCategories = (): Promise<Lookup[]> =>
  request<Lookup[]>({ url: '/admin/category' });

export const createCategory = (name: string): Promise<Lookup> =>
  request<Lookup>({ url: '/admin/category', method: 'POST', data: { name } });

export const renameCategory = (name: string, newName: string): Promise<Lookup> =>
  request<Lookup>({ url: '/admin/category', method: 'PUT', data: { name, newName } });

export const deleteCategory = (name: string): Promise<Lookup> =>
  request<Lookup>({
    url: `/admin/category/${encodeURIComponent(name)}`,
    method: 'DELETE',
  });
