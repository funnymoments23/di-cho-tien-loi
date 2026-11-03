import { request } from './client';
import type { LookupItem } from '../types/models';

export const lookupApi = {
  categories: () => request<LookupItem[]>({ url: '/admin/category' }),

  units: () => request<LookupItem[]>({ url: '/admin/unit' }),

  createCategory: (name: string) =>
    request<LookupItem>({
      method: 'POST',
      url: '/admin/category',
      data: { name },
    }),

  updateCategory: (name: string, newName: string) =>
    request<LookupItem>({
      method: 'PUT',
      url: '/admin/category',
      data: { name, newName },
    }),

  deleteCategory: (name: string) =>
    request<LookupItem>({
      method: 'DELETE',
      url: `/admin/category/${encodeURIComponent(name)}`,
    }),

  createUnit: (name: string) =>
    request<LookupItem>({
      method: 'POST',
      url: '/admin/unit',
      data: { name },
    }),

  updateUnit: (name: string, newName: string) =>
    request<LookupItem>({
      method: 'PUT',
      url: '/admin/unit',
      data: { name, newName },
    }),

  deleteUnit: (name: string) =>
    request<LookupItem>({
      method: 'DELETE',
      url: `/admin/unit/${encodeURIComponent(name)}`,
    }),
};
