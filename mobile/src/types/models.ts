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

export type RecipeSuggestion = {
  id: string;
  groupId: string;
  foodId: string | null;
  foodName: string | null;
  image: string | null;
  name: string;
  description: string;
  htmlContent: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  location: string | null;
  note: string | null;
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
