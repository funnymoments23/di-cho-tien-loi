import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/api/queryKeys';
import { shoppingApi } from '@/api/shopping.api';
import type { ShoppingList } from '@/types/models';

export function useToggleShoppingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      isCompleted,
    }: {
      taskId: string;
      isCompleted: boolean;
    }) => shoppingApi.completeTask(taskId, isCompleted),

    onMutate: async ({ taskId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: qk.shopping });
      const previous = queryClient.getQueryData<ShoppingList[]>(qk.shopping);

      queryClient.setQueryData<ShoppingList[]>(qk.shopping, (old) =>
        old?.map((list) => {
          if (!list.tasks?.some((task) => task.id === taskId)) return list;
          const tasks = list.tasks.map((task) =>
            task.id === taskId ? { ...task, isCompleted } : task
          );
          return {
            ...list,
            tasks,
            completedCount: tasks.filter((task) => task.isCompleted).length,
          };
        })
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.shopping, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.shopping });
      void queryClient.invalidateQueries({ queryKey: qk.report('overview') });
    },
  });
}
