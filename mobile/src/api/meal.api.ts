import { request } from './client';
import type { MealPlan } from '../types/models';

export type CreateMealPayload = {
  foodName: string;
  timestamp: string;
  name: string;
};

export type UpdateMealPayload = {
  planId: string;
  newFoodName?: string;
  newTimestamp?: string;
  newName?: string;
};

export const mealApi = {
  create: (body: CreateMealPayload) =>
    request<MealPlan>({
      method: 'POST',
      url: '/meal',
      data: body,
    }),

  update: (body: UpdateMealPayload) =>
    request<MealPlan>({
      method: 'PUT',
      url: '/meal',
      data: body,
    }),

  remove: (planId: string) =>
    request<MealPlan>({
      method: 'DELETE',
      url: `/meal/${planId}`,
    }),
};
