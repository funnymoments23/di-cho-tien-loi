import { request } from './client';
import type { ShoppingList, ShoppingTask } from '../types/models';

export type CreateShoppingListPayload = {
  name: string;
  assignToUsername: string;
  note?: string;
  date?: string;
};

export type UpdateShoppingListPayload = {
  listId: string;
  newName?: string;
  newAssignToUsername?: string;
  newNote?: string;
  newDate?: string;
};

export type ShoppingTaskInput = {
  foodName: string;
  quantity: number;
};

export const shoppingApi = {
  lists: () => request<ShoppingList[]>({ url: '/shopping' }),

  createList: (body: CreateShoppingListPayload) =>
    request<ShoppingList>({
      method: 'POST',
      url: '/shopping',
      data: body,
    }),

  updateList: (body: UpdateShoppingListPayload) =>
    request<ShoppingList>({
      method: 'PUT',
      url: '/shopping',
      data: body,
    }),

  deleteList: (listId: string) =>
    request<ShoppingList>({
      method: 'DELETE',
      url: `/shopping/${listId}`,
    }),

  addTasks: (listId: string, tasks: ShoppingTaskInput[]) =>
    request<ShoppingTask[]>({
      method: 'POST',
      url: '/shopping/task',
      data: { listId, tasks },
    }),

  updateTask: (body: {
    taskId: string;
    newFoodName?: string;
    newQuantity?: number;
  }) =>
    request<ShoppingTask>({
      method: 'PUT',
      url: '/shopping/task',
      data: body,
    }),

  deleteTask: (taskId: string) =>
    request<ShoppingTask>({
      method: 'DELETE',
      url: `/shopping/task/${taskId}`,
    }),

  completeTask: (taskId: string, isCompleted: boolean) =>
    request<ShoppingTask>({
      method: 'PATCH',
      url: `/shopping/task/${taskId}/complete`,
      data: { isCompleted },
    }),
};
