import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { foodApi } from '@/api/food.api';
import { qk } from '@/api/queryKeys';
import { recipeApi } from '@/api/recipe.api';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { FormMessage } from '@/components/ui/FormMessage';
import { LinkText } from '@/components/ui/LinkText';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SelectField } from '@/components/ui/SelectField';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { colors, radius, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import { htmlToPlainText, plainTextToHtml } from '@/utils/recipe';
import type { Recipe } from '@/types/models';

type IngredientRow = {
  key: string;
  foodName: string;
  quantity: string;
};

const newIngredientRow = (): IngredientRow => ({
  key: `${Date.now()}-${Math.random()}`,
  foodName: '',
  quantity: '1',
});

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ editId?: string | string[] }>();
  const editId = Array.isArray(params.editId) ? params.editId[0] : params.editId;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    newIngredientRow(),
  ]);
  const [steps, setSteps] = useState('');
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  const recipesQuery = useQuery({
    queryKey: qk.recipes(),
    queryFn: () => recipeApi.list(),
  });
  const foodsQuery = useQuery({
    queryKey: qk.foods({}),
    queryFn: () => foodApi.list({}),
    enabled: editorOpen,
  });

  const recipes = recipesQuery.data ?? [];
  const foodOptions = (foodsQuery.data ?? []).map((food) => ({
    id: food.id,
    name: food.name,
    label: food.unitName ? `${food.name} (${food.unitName})` : food.name,
  }));

  const keyword = search.trim().toLowerCase();
  const filtered = keyword
    ? recipes.filter((recipe) =>
        [recipe.name, recipe.foodName, recipe.description]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword))
      )
    : recipes;

  const refreshRecipes = () => {
    void queryClient.invalidateQueries({ queryKey: qk.recipesRoot });
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setIngredients([newIngredientRow()]);
    setSteps('');
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (recipe: Recipe) => {
    setEditing(recipe);
    setName(recipe.name);
    setDescription(recipe.description);
    const recipeIngredients = recipe.ingredients ?? [];
    setIngredients(
      recipeIngredients.length > 0
        ? recipeIngredients.map((ingredient) => ({
            key: `${recipe.id}-${ingredient.foodId}`,
            foodName: ingredient.foodName ?? '',
            quantity: String(ingredient.quantity),
          }))
        : [newIngredientRow()]
    );
    setSteps(htmlToPlainText(recipe.htmlContent));
    setEditorError('');
    setEditorOpen(true);
  };

  const updateIngredient = (
    key: string,
    patch: Partial<Pick<IngredientRow, 'foodName' | 'quantity'>>
  ) => {
    setIngredients((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  };

  const addIngredient = () => {
    setIngredients((rows) => [...rows, newIngredientRow()]);
  };

  const removeIngredient = (key: string) => {
    setIngredients((rows) =>
      rows.length > 1 ? rows.filter((row) => row.key !== key) : rows
    );
  };

  // Tự mở form sửa khi được điều hướng tới với ?editId=... nhưng chỉ một lần
  // và khi danh sách công thức đã tải xong.
  const autoEditRecipe =
    editId && !autoOpened && !recipesQuery.isLoading
      ? recipes.find((item) => item.id === editId)
      : undefined;
  if (autoEditRecipe) {
    setAutoOpened(true);
    openEdit(autoEditRecipe);
  }

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const save = async () => {
    setEditorError('');
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedSteps = steps.trim();

    if (!trimmedName) {
      setEditorError('Vui lòng nhập tên công thức.');
      return;
    }
    if (trimmedName.length > 200) {
      setEditorError('Tên công thức tối đa 200 ký tự.');
      return;
    }
    if (!trimmedDescription) {
      setEditorError('Vui lòng nhập mô tả.');
      return;
    }
    if (trimmedDescription.length > 2000) {
      setEditorError('Mô tả tối đa 2.000 ký tự.');
      return;
    }
    if (!trimmedSteps) {
      setEditorError('Vui lòng nhập cách làm.');
      return;
    }

    const normalizedIngredients = ingredients.map((row) => ({
      foodName: row.foodName,
      quantity: Number(row.quantity.replace(',', '.')),
    }));

    if (normalizedIngredients.length === 0) {
      setEditorError('Vui lòng thêm ít nhất một nguyên liệu.');
      return;
    }
    if (normalizedIngredients.some((item) => !item.foodName)) {
      setEditorError('Vui lòng chọn thực phẩm cho mọi nguyên liệu.');
      return;
    }
    if (
      normalizedIngredients.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > 1_000_000
      )
    ) {
      setEditorError('Số lượng nguyên liệu phải là số dương.');
      return;
    }

    const uniqueFoodNames = new Set(
      normalizedIngredients.map((item) => item.foodName)
    );
    if (uniqueFoodNames.size !== normalizedIngredients.length) {
      setEditorError('Mỗi nguyên liệu chỉ được chọn một lần.');
      return;
    }

    const originalSteps = editing ? htmlToPlainText(editing.htmlContent) : '';
    const stepsChanged = !editing || trimmedSteps !== originalSteps;
    const htmlContent = stepsChanged
      ? plainTextToHtml(trimmedSteps)
      : editing!.htmlContent;
    const ingredientSignature = (items: { foodName: string; quantity: number }[]) =>
      items
        .map((item) => `${item.foodName}:${item.quantity}`)
        .sort()
        .join('|');

    if (editing) {
      const ingredientsChanged =
        ingredientSignature(normalizedIngredients) !==
        ingredientSignature(
          (editing.ingredients ?? []).map((item) => ({
            foodName: item.foodName ?? '',
            quantity: item.quantity,
          }))
        );

      const changed =
        trimmedName !== editing.name ||
        trimmedDescription !== editing.description ||
        stepsChanged ||
        ingredientsChanged;

      if (!changed) {
        setEditorError('Chưa có thay đổi nào.');
        return;
      }

      setSaving(true);
      try {
        await recipeApi.update({
          recipeId: editing.id,
          ...(trimmedName !== editing.name ? { newName: trimmedName } : {}),
          ...(trimmedDescription !== editing.description
            ? { newDescription: trimmedDescription }
            : {}),
          ...(stepsChanged ? { newHtmlContent: htmlContent } : {}),
          ...(ingredientsChanged
            ? { newIngredients: normalizedIngredients }
            : {}),
        });
        setEditorOpen(false);
        setNotice(`Đã cập nhật công thức "${trimmedName}".`);
        refreshRecipes();
      } catch (err) {
        setEditorError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      await recipeApi.create({
        name: trimmedName,
        description: trimmedDescription,
        htmlContent,
        ingredients: normalizedIngredients,
      });
      setEditorOpen(false);
      setNotice(`Đã thêm công thức "${trimmedName}".`);
      refreshRecipes();
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (recipe: Recipe) => {
    setError('');
    setNotice('');
    setDeletingId(recipe.id);
    try {
      await recipeApi.remove(recipe.id);
      setNotice(`Đã xoá công thức "${recipe.name}".`);
      refreshRecipes();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const confirmRemove = (recipe: Recipe) => {
    Alert.alert(
      'Xoá công thức',
      `Xoá công thức "${recipe.name}"?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void remove(recipe),
        },
      ]
    );
  };

  return (
    <>
      <Screen
        refreshing={recipesQuery.isRefetching}
        onRefresh={() => void recipesQuery.refetch()}
      >
        <ScreenHeader
          title="Công thức"
          subtitle={`${recipes.length} công thức trong nhóm`}
          onBack={() => router.back()}
        />

        {notice ? <FormMessage type="success" message={notice} /> : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        <AppInput
          label="Tìm công thức"
          value={search}
          onChangeText={setSearch}
          placeholder="Tên món, thực phẩm, mô tả..."
          returnKeyType="search"
        />

        {recipesQuery.isLoading ? (
          <LoadingState message="Đang tải công thức..." />
        ) : recipesQuery.isError ? (
          <ErrorState
            message={getErrorMessage(recipesQuery.error)}
            onRetry={() => void recipesQuery.refetch()}
          />
        ) : recipes.length === 0 ? (
          <EmptyState
            title="Chưa có công thức nào"
            message="Thêm công thức đầu tiên để lưu cách nấu các món của gia đình."
            icon="book-outline"
            action={
              <AppButton
                title="Thêm công thức"
                onPress={openCreate}
                variant="outline"
              />
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Không tìm thấy công thức"
            message="Thử từ khóa khác."
            icon="search-outline"
          />
        ) : (
          <>
            {filtered.map((recipe) => (
              <SectionCard key={recipe.id}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/recipes/[recipeId]',
                      params: { recipeId: recipe.id },
                    })
                  }
                  style={styles.recipeRow}
                >
                  <View style={styles.recipeBody}>
                    <Text style={styles.recipeName} numberOfLines={2}>
                      {recipe.name}
                    </Text>
                    <Text style={styles.recipeMeta} numberOfLines={1}>
                      {(recipe.ingredients ?? []).length} nguyên liệu
                    </Text>
                    <Text style={styles.recipeDescription} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.cardActions}>
                  <LinkText
                    onPress={() =>
                      router.push({
                        pathname: '/recipes/[recipeId]',
                        params: { recipeId: recipe.id },
                      })
                    }
                  >
                    Xem
                  </LinkText>
                  <View style={styles.adminActions}>
                    <LinkText onPress={() => openEdit(recipe)}>Sửa</LinkText>
                    <LinkText onPress={() => confirmRemove(recipe)}>
                      {deletingId === recipe.id ? 'Đang xoá...' : 'Xoá'}
                    </LinkText>
                  </View>
                </View>
              </SectionCard>
            ))}
          </>
        )}

        {!recipesQuery.isLoading &&
        !recipesQuery.isError &&
        recipes.length > 0 ? (
          <AppButton
            title="Thêm công thức"
            onPress={openCreate}
            style={styles.addRecipeButton}
          />
        ) : null}
      </Screen>

      <Modal
        visible={editorOpen}
        transparent
        animationType="fade"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>
                {editing ? 'Sửa công thức' : 'Thêm công thức'}
              </Text>
              <Text style={styles.modalHint}>
                Thêm nguyên liệu và nhập cách làm. Mỗi bước một dòng.
              </Text>

              {foodsQuery.isLoading ? (
                <FormMessage type="info" message="Đang tải kho thực phẩm..." />
              ) : foodOptions.length === 0 ? (
                <FormMessage
                  type="info"
                  message="Kho thực phẩm đang trống. Thêm thực phẩm trước khi tạo công thức."
                />
              ) : null}

              <AppInput
                label="Tên công thức"
                value={name}
                onChangeText={setName}
                placeholder="Ví dụ: Thịt kho trứng"
                maxLength={200}
              />

              <AppInput
                label="Mô tả ngắn"
                value={description}
                onChangeText={setDescription}
                placeholder="Mô tả ngắn về món ăn"
                multiline
                numberOfLines={3}
                maxLength={2000}
                style={styles.descriptionInput}
              />

              <View style={styles.ingredientsHeader}>
                <Text style={styles.sectionLabel}>Nguyên liệu</Text>
              </View>

              {ingredients.map((row, index) => (
                <View key={row.key} style={styles.ingredientBlock}>
                  <View style={styles.ingredientRow}>
                    <View style={styles.ingredientFood}>
                      <SelectField
                        label={`Nguyên liệu ${index + 1}`}
                        value={row.foodName}
                        placeholder="Chọn thực phẩm"
                        options={foodOptions}
                        onChange={(value) =>
                          updateIngredient(row.key, { foodName: value })
                        }
                      />
                    </View>

                    <View style={styles.ingredientQuantity}>
                      <AppInput
                        label="Số lượng"
                        value={row.quantity}
                        onChangeText={(value) =>
                          updateIngredient(row.key, { quantity: value })
                        }
                        placeholder="1"
                        keyboardType="decimal-pad"
                        maxLength={10}
                      />
                    </View>
                  </View>

                  {ingredients.length > 1 ? (
                    <View style={styles.removeIngredient}>
                      <LinkText onPress={() => removeIngredient(row.key)}>
                        Xoá nguyên liệu
                      </LinkText>
                    </View>
                  ) : null}
                </View>
              ))}

              <AppButton
                title="Thêm nguyên liệu"
                onPress={addIngredient}
                variant="outline"
                style={styles.addIngredient}
              />

              <AppInput
                label="Cách làm"
                value={steps}
                onChangeText={setSteps}
                placeholder="Mô tả cách làm với mỗi bước trên một dòng"
                multiline
                numberOfLines={8}
                maxLength={200000}
                style={styles.stepsInput}
              />

              {editorError ? (
                <FormMessage type="error" message={editorError} />
              ) : null}

              <AppButton
                title="Lưu"
                onPress={save}
                loading={saving}
                disabled={!name || !description || !steps}
              />
              <AppButton
                title="Huỷ"
                onPress={closeEditor}
                variant="outline"
                style={styles.modalCancel}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  recipeBody: {
    flex: 1,
  },
  recipeName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  recipeMeta: {
    ...typography.caption,
    color: colors.primaryText,
    marginTop: 2,
  },
  recipeDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  adminActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addRecipeButton: {
    marginTop: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    ...typography.heading,
    color: colors.text,
  },
  modalHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  descriptionInput: {
    minHeight: 82,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  ingredientBlock: {
    marginBottom: spacing.xs,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  ingredientFood: {
    flex: 1,
  },
  ingredientQuantity: {
    width: 108,
  },
  removeIngredient: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  addIngredient: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  stepsInput: {
    minHeight: 160,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  modalCancel: {
    marginTop: spacing.md,
  },
});
