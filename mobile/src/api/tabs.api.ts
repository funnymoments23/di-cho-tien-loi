import { request } from './client';
import type {
  FridgeItem,
  MealPlan,
  RecipeSuggestion,
  ReportOverview,
  ShoppingList,
} from '../types/models';

export const tabsApi = {
  fridge: () => request<FridgeItem[]>({ url: '/fridge' }),

  shoppingLists: () => request<ShoppingList[]>({ url: '/shopping' }),

  meals: (date: string) =>
    request<MealPlan[]>({ url: '/meal', params: { date } }),

  mealSuggestions: () =>
    request<RecipeSuggestion[]>({ url: '/meal/suggestion' }),

  reportOverview: () => request<ReportOverview>({ url: '/report/overview' }),
};
