// src/api/queryKeys.ts
export type FoodFilter = {
  keyword?: string;
  categoryName?: string;
  inFridge?: boolean;
};

export type DateRange = {
  from?: string;
  to?: string;
};

export type ReportType =
  | 'overview'
  | 'shopping'
  | 'consumption'
  | 'waste'
  | 'fridge';

export const qk = {
  me: ['me'] as const,
  group: ['group'] as const,
  categories: ['categories'] as const,
  units: ['units'] as const,

  foods: (filter?: FoodFilter) => ['foods', filter ?? null] as const,
  fridge: ['fridge'] as const,
  shopping: ['shopping'] as const,
  meals: (date: string) => ['meals', date] as const,
  mealSuggestion: ['meals', 'suggestion'] as const,
  recipes: (foodId?: string) => ['recipes', foodId ?? null] as const,
  report: (type: ReportType, range?: DateRange) =>
    ['report', type, range ?? null] as const,
};