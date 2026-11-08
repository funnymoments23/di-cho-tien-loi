import { request } from './client';
import type { Lookup } from '../types';

export const listUnits = (): Promise<Lookup[]> =>
  request<Lookup[]>({ url: '/admin/unit' });

export const createUnit = (name: string): Promise<Lookup> =>
  request<Lookup>({ url: '/admin/unit', method: 'POST', data: { name } });

export const renameUnit = (name: string, newName: string): Promise<Lookup> =>
  request<Lookup>({ url: '/admin/unit', method: 'PUT', data: { name, newName } });

export const deleteUnit = (name: string): Promise<Lookup> =>
  request<Lookup>({
    url: `/admin/unit/${encodeURIComponent(name)}`,
    method: 'DELETE',
  });
