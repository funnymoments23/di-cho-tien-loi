import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { qk } from '@/api/queryKeys';
import { recipeApi } from '@/api/recipe.api';
import { AppButton } from '@/components/ui/AppButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { colors, radius, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams<{
    recipeId?: string | string[];
  }>();
  const recipeId = Array.isArray(params.recipeId)
    ? params.recipeId[0]
    : params.recipeId;

  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  const recipesQuery = useQuery({
    queryKey: qk.recipes(),
    queryFn: () => recipeApi.list(),
  });

  const recipe = recipesQuery.data?.find((item) => item.id === recipeId);

  const remove = async () => {
    if (!recipe) return;
    try {
      await recipeApi.remove(recipe.id);
      queryClient.invalidateQueries({ queryKey: qk.recipesRoot });
      router.back();
    } catch (err) {
      Alert.alert('Không xoá được', getErrorMessage(err));
    }
  };

  const confirmRemove = () => {
    if (!recipe) return;
    Alert.alert(
      'Xoá công thức',
      `Xoá công thức "${recipe.name}"?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void remove(),
        },
      ]
    );
  };

  return (
    <Screen
      refreshing={recipesQuery.isRefetching}
      onRefresh={() => void recipesQuery.refetch()}
    >
      <ScreenHeader
        title={recipe?.name ?? 'Công thức'}
        subtitle={recipe?.foodName ?? 'Chi tiết công thức'}
        onBack={() => router.back()}
      />

      {recipesQuery.isLoading ? (
        <LoadingState message="Đang tải công thức..." />
      ) : recipesQuery.isError ? (
        <ErrorState
          message={getErrorMessage(recipesQuery.error)}
          onRetry={() => void recipesQuery.refetch()}
        />
      ) : !recipe ? (
        <EmptyState
          title="Không tìm thấy công thức"
          message="Công thức có thể đã bị xoá."
          icon="book-outline"
          action={
            <AppButton
              title="Quay lại"
              onPress={() => router.back()}
              variant="outline"
            />
          }
        />
      ) : (
        <>
          <SectionCard>
            <Text style={styles.foodName}>
              {recipe.foodName ?? 'Chưa gắn món ăn'}
            </Text>
            <Text style={styles.description}>{recipe.description}</Text>
          </SectionCard>

          {(recipe.ingredients ?? []).length > 0 ? (
            <SectionCard title="Nguyên liệu">
              {(recipe.ingredients ?? []).map((ingredient, index, all) => (
                <View
                  key={`${ingredient.foodId ?? ingredient.foodName}-${index}`}
                  style={[
                    styles.ingredientRow,
                    index < all.length - 1 && styles.ingredientDivider,
                  ]}
                >
                  <Text style={styles.ingredientName}>
                    {ingredient.foodName ?? 'Nguyên liệu đã bị xoá'}
                  </Text>
                  <Text style={styles.ingredientQuantity}>
                    {ingredient.quantity} {ingredient.unitName ?? ''}
                  </Text>
                </View>
              ))}
            </SectionCard>
          ) : null}

          <SectionCard title="Cách làm">
            {recipe.htmlContent ? (
              <View style={styles.html}>
                <RenderHTML
                  contentWidth={width - spacing.lg * 4}
                  source={{ html: recipe.htmlContent }}
                  baseStyle={styles.htmlBase}
                  tagsStyles={htmlTagsStyles}
                />
              </View>
            ) : (
              <Text style={styles.empty}>Chưa có nội dung công thức.</Text>
            )}
          </SectionCard>

          <View style={styles.actions}>
            <AppButton
              title="Sửa công thức"
              onPress={() =>
                router.replace({
                  pathname: '/recipes',
                  params: { editId: recipe.id },
                })
              }
              variant="outline"
              style={styles.actionButton}
            />
            <AppButton
              title="Xoá"
              onPress={confirmRemove}
              variant="outline"
              style={styles.actionButton}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  foodName: {
    ...typography.label,
    color: colors.primaryText,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  ingredientDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  ingredientName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  ingredientQuantity: {
    ...typography.bodyStrong,
    color: colors.textMuted,
  },
  html: {
    marginHorizontal: -spacing.xs,
  },
  htmlBase: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});

const htmlTagsStyles = {
  p: { marginTop: 0, marginBottom: 8 },
  li: { marginBottom: 4 },
  h1: { fontSize: 22, marginTop: 8, marginBottom: 8 },
  h2: { fontSize: 19, marginTop: 8, marginBottom: 6 },
  h3: { fontSize: 17, marginTop: 8, marginBottom: 4 },
  a: { color: colors.primaryText },
} as const;
