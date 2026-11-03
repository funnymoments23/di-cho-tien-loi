import { request } from './client';
import type { FridgeItem } from '../types/models';

export type CreateFridgePayload = {
  foodName: string;
  quantity: number;
  useWithin: string;
  location?: string;
  note?: string;
};

export type UpdateFridgePayload = {
  itemId: string;
  newFoodName?: string;
  newQuantity?: number;
  newUseWithin?: string;
  newNote?: string;
  newLocation?: string;
};

export const fridgeApi = {
  list: () => request<FridgeItem[]>({ url: '/fridge' }),

  create: (body: CreateFridgePayload) =>
    request<FridgeItem>({
      method: 'POST',
      url: '/fridge',
      data: body,
    }),

  update: (body: UpdateFridgePayload) =>
    request<FridgeItem>({
      method: 'PUT',
      url: '/fridge',
      data: body,
    }),

  remove: (itemId: string) =>
    request<FridgeItem>({
      method: 'DELETE',
      url: `/fridge/${itemId}`,
    }),
};
