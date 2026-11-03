import type { Paginated } from '../types/api';

export const unwrapList = <T>(data: T[] | Paginated<T>): T[] =>
  Array.isArray(data) ? data : data.items;