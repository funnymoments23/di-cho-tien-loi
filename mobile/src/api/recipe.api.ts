import { request } from './client';
import type { Recipe } from '../types/models';

export type RecipeIngredientInput = {
  foodName: string;
  quantity: number;
};

export type CreateRecipePayload = {
  name: string;
  description: string;
  htmlContent: string;
  ingredients: RecipeIngredientInput[];
};

export type UpdateRecipePayload = {
  recipeId: string;
  newFoodName?: string;
  newName?: string;
  newDescription?: string;
  newHtmlContent?: string;
  newIngredients?: RecipeIngredientInput[];
};

export const recipeApi = {
  list: (filters?: { foodId?: string; foodName?: string }) =>
    request<Recipe[]>({
      url: '/recipe',
      params: {
        foodId: filters?.foodId,
        foodName: filters?.foodName,
      },
    }),

  create: (body: CreateRecipePayload) =>
    request<Recipe>({
      method: 'POST',
      url: '/recipe',
      data: body,
    }),

  update: (body: UpdateRecipePayload) =>
    request<Recipe>({
      method: 'PUT',
      url: '/recipe',
      data: body,
    }),

  remove: (recipeId: string) =>
    request<Recipe>({
      method: 'DELETE',
      url: `/recipe/${recipeId}`,
    }),
};
