import type { User } from './api';

export type LookupItem = {
  id: string;
  name: string;
};

export type GroupSummary = {
  id: string;
  name: string;
  adminId: string;
  memberCount: number;
  createdAt: string;
};

export type GroupDetail = GroupSummary & {
  members: User[];
};

export type GroupInfo = {
  id: string;
  name: string;
  adminId: string;
  memberCount: number;
  createdAt: string;
  isAdmin: boolean;
  admin: {
    id: string;
    name: string;
    username: string | null;
  } | null;
};

export type Food = {
  id: string;
  name: string;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitId: string | null;
  unitName: string | null;
  groupId: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FridgeItem = {
  id: string;
  foodId: string | null;
  foodName: string | null;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitId: string | null;
  unitName: string | null;
  quantity: number;
  useWithin: string;
  location: string | null;
  note: string | null;
  isNotified: boolean;
  groupId: string;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingTask = {
  id: string;
  listId: string;
  foodId: string | null;
  foodName: string | null;
  image: string | null;
  unitId: string | null;
  unitName: string | null;
  quantity: number;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingList = {
  id: string;
  name: string;
  groupId: string;
  assignedTo: string;
  assignedToUsername: string | null;
  assignedToName: string | null;
  note: string | null;
  date: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: ShoppingTask[];
  taskCount?: number;
  completedCount?: number;
};

export type MealPlan = {
  id: string;
  groupId: string;
  foodId: string | null;
  foodName: string | null;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitId: string | null;
  unitName: string | null;
  timestamp: string;
  name: 'sáng' | 'trưa' | 'tối' | string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredient = {
  foodId: string | null;
  foodName: string | null;
  unitId: string | null;
  unitName: string | null;
  quantity: number;
};

export type Recipe = {
  id: string;
  groupId: string;
  foodId: string | null;
  foodName: string | null;
  name: string;
  description: string;
  htmlContent: string;
  ingredients: RecipeIngredient[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeSuggestionIngredient = {
  foodId: string | null;
  foodName: string | null;
  quantity: number;
  unitName: string | null;
  fridgeQuantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  location: string | null;
  note: string | null;
};

export type RecipeSuggestion = Omit<Recipe, 'ingredients'> & {
  reason: string;
  matchedCount: number;
  totalIngredients: number;
  matchedIngredients: RecipeSuggestionIngredient[];
  missingIngredients: { foodId: string | null; foodName: string | null }[];
  // Trường tương thích của gợi ý cũ: lấy theo nguyên liệu khớp gần hết hạn nhất.
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  location: string | null;
  note: string | null;
};

export type ReportOverview = {
  range: { from: string; to: string; days: number };
  shopping: {
    lists: number;
    items: number;
    completedItems: number;
    createdCompletedItems: number;
    completionRate: number;
  };
  consumption: {
    items: number;
    quantity: number;
  };
  waste: {
    items: number;
    quantity: number;
    consumedQuantity: number;
    wasteRate: number;
  };
  fridge: {
    totalItems: number;
    totalQuantity: number;
    expiringSoon: number;
    expired: number;
  };
};
