import { request } from './client';
import type { FoodFilter } from './queryKeys';
import type { Food } from '../types/models';

export const foodApi = {
  list: (filter: FoodFilter = {}) =>
    request<Food[]>({
      url: '/food/search',
      params: {
        keyword: filter.keyword || undefined,
        categoryName: filter.categoryName || undefined,
        inFridge: filter.inFridge,
      },
    }),

  create: (form: FormData) =>
    request<Food>({
      method: 'POST',
      url: '/food',
      data: form,
    }),

  update: (form: FormData) =>
    request<Food>({
      method: 'PUT',
      url: '/food',
      data: form,
    }),

  remove: (foodId: string) =>
    request<Food>({
      method: 'DELETE',
      url: `/food/${foodId}`,
    }),
};
