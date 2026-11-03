import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { foodApi } from '@/api/food.api';
import { groupApi } from '@/api/group.api';
import { qk } from '@/api/queryKeys';
import { mealApi } from '@/api/meal.api';
import { tabsApi } from '@/api/tabs.api';
import { AppButton } from '@/components/ui/AppButton';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { LinkText } from '@/components/ui/LinkText';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SelectField } from '@/components/ui/SelectField';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { colors, radius, spacing, typography } from '@/theme';
import {
  formatDate,
  formatMealDate,
  getNextDays,
  todayKey,
} from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { MealPlan, RecipeSuggestion } from '@/types/models';

const mealNames = ['sáng', 'trưa', 'tối'] as const;

const MEAL_OPTIONS = [
  { id: 'sáng', name: 'sáng', label: 'Sáng' },
  { id: 'trưa', name: 'trưa', label: 'Trưa' },
  { id: 'tối', name: 'tối', label: 'Tối' },
];

const toUtcIso = (date: Date) =>
  new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  ).toISOString();

export default function MealScreen() {
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(todayKey());
  const days = getNextDays(7);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MealPlan | null>(null);
  const [foodName, setFoodName] = useState('');
  const [mealName, setMealName] = useState<string>('sáng');
  const [mealDate, setMealDate] = useState(new Date());
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const mealsQuery = useQuery({
    queryKey: qk.meals(selectedDate),
    queryFn: () => tabsApi.meals(selectedDate),
  });
  const suggestionsQuery = useQuery({
    queryKey: qk.mealSuggestion,
    queryFn: tabsApi.mealSuggestions,
  });
  const groupQuery = useQuery({
    queryKey: qk.groupInfo,
    queryFn: groupApi.info,
    retry: false,
  });
  const foodsQuery = useQuery({
    queryKey: qk.foods({}),
    queryFn: () => foodApi.list({}),
    enabled: editorOpen,
  });

  const meals = mealsQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];
  const foodOptions = (foodsQuery.data ?? []).map((food) => ({
    id: food.id,
    name: food.name,
  }));
  const isAdmin = groupQuery.data?.isAdmin ?? false;

  const mealItems = (name: (typeof mealNames)[number]) =>
    meals.filter((meal) => meal.name === name);

  const refreshMeals = () => {
    void queryClient.invalidateQueries({ queryKey: qk.mealsRoot });
  };

  const openCreate = (
    name: (typeof mealNames)[number],
    suggestedFoodName = ''
  ) => {
    setEditing(null);
    setMealName(name);
    setFoodName(suggestedFoodName);
    const date = new Date(`${selectedDate}T12:00:00`);
    setMealDate(Number.isNaN(date.getTime()) ? new Date() : date);
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (item: MealPlan) => {
    setEditing(item);
    setMealName(item.name);
    setFoodName(item.foodName ?? '');
    const date = new Date(item.timestamp);
    setMealDate(Number.isNaN(date.getTime()) ? new Date() : date);
    setEditorError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const openSuggestions = () => {
    setSuggestOpen(true);
    void suggestionsQuery.refetch();
  };

  const addSuggestionToMeal = (suggestion: RecipeSuggestion) => {
    const foodName =
      suggestion.matchedIngredients[0]?.foodName ??
      suggestion.foodName ??
      '';

    if (!foodName) {
      setError('Không tìm thấy nguyên liệu phù hợp để thêm vào bữa ăn.');
      return;
    }

    setSuggestOpen(false);
    openCreate('trưa', foodName);
  };

  const save = async () => {
    setEditorError('');
    if (!foodName) {
      setEditorError('Vui lòng chọn thực phẩm.');
      return;
    }
    if (!mealName) {
      setEditorError('Vui lòng chọn bữa.');
      return;
    }

    const timestamp = toUtcIso(mealDate);

    if (editing) {
      const changed =
        foodName !== (editing.foodName ?? '') ||
        mealName !== editing.name ||
        formatDate(mealDate) !== formatDate(editing.timestamp);

      if (!changed) {
        setEditorError('Chưa có thay đổi nào.');
        return;
      }

      setSaving(true);
      try {
        await mealApi.update({
          planId: editing.id,
          ...(foodName !== (editing.foodName ?? '')
            ? { newFoodName: foodName }
            : {}),
          ...(mealName !== editing.name ? { newName: mealName } : {}),
          ...(formatDate(mealDate) !== formatDate(editing.timestamp)
            ? { newTimestamp: timestamp }
            : {}),
        });
        setEditorOpen(false);
        setNotice(`Đã cập nhật bữa ${mealName}.`);
        refreshMeals();
      } catch (err) {
        setEditorError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      await mealApi.create({
        foodName,
        timestamp,
        name: mealName,
      });
      setEditorOpen(false);
      setNotice(`Đã thêm "${foodName}" vào bữa ${mealName}.`);
      refreshMeals();
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: MealPlan) => {
    setError('');
    setNotice('');
    setDeletingId(item.id);
    try {
      await mealApi.remove(item.id);
      setNotice(`Đã xoá "${item.foodName ?? 'món ăn'}".`);
      refreshMeals();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const confirmRemove = (item: MealPlan) => {
    Alert.alert(
      'Xoá món khỏi bữa',
      `Xoá "${item.foodName ?? 'món ăn'}" khỏi bữa ${item.name}?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void remove(item),
        },
      ]
    );
  };

  return (
    <>
      <Screen
        refreshing={mealsQuery.isRefetching || suggestionsQuery.isRefetching}
        onRefresh={() => {
          void mealsQuery.refetch();
          void suggestionsQuery.refetch();
        }}
      >
        <ScreenHeader
          boxed
          title="Bữa ăn"
          subtitle={formatMealDate(selectedDate)}
        />

        {notice ? <FormMessage type="success" message={notice} /> : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        <View style={styles.weekStrip}>
          {days.map((day) => {
            const selected = day.key === selectedDate;
            return (
              <Pressable
                key={day.key}
                onPress={() => setSelectedDate(day.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.day,
                  day.isToday && styles.today,
                  selected && styles.daySelected,
                ]}
              >
                <Text
                  style={[
                    styles.weekday,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {day.weekday}
                </Text>
                <Text
                  style={[
                    styles.dayNumber,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {day.day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AppButton
          title={
            suggestions.length > 0
              ? `Gợi ý món từ tủ lạnh (${suggestions.length})`
              : 'Gợi ý món từ tủ lạnh'
          }
          onPress={openSuggestions}
          variant="outline"
          style={styles.suggestionButton}
        />

        {mealsQuery.isLoading ? (
          <LoadingState message="Đang tải lịch bữa ăn..." />
        ) : mealsQuery.isError ? (
          <ErrorState
            message={getErrorMessage(mealsQuery.error)}
            onRetry={() => void mealsQuery.refetch()}
          />
        ) : (
          <>
            {mealNames.map((name) => (
              <SectionCard
                key={name}
                title={capitalize(name)}
                action={
                  isAdmin ? (
                    <LinkText onPress={() => openCreate(name)}>Thêm</LinkText>
                  ) : null
                }
              >
                <MealList
                  items={mealItems(name)}
                  isAdmin={isAdmin}
                  deletingId={deletingId}
                  onEdit={openEdit}
                  onDelete={confirmRemove}
                />
              </SectionCard>
            ))}

            <SectionCard title="Công thức nấu ăn">
              <Text style={styles.suggestionHint}>
                Xem và chia sẻ cách nấu các món của gia đình.
              </Text>
              <AppButton
                title="Xem công thức"
                onPress={() => router.push('/recipes')}
                variant="outline"
              />
            </SectionCard>
          </>
        )}
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
                {editing ? 'Sửa món trong bữa' : 'Thêm món vào bữa'}
              </Text>
              <Text style={styles.modalHint}>
                Chọn thực phẩm có sẵn trong kho của nhóm.
              </Text>

              {foodsQuery.isLoading ? (
                <FormMessage type="info" message="Đang tải kho thực phẩm..." />
              ) : foodOptions.length === 0 ? (
                <FormMessage
                  type="info"
                  message="Kho thực phẩm đang trống. Thêm thực phẩm trước khi lập bữa ăn."
                />
              ) : null}

              <SelectField
                label="Thực phẩm"
                value={foodName}
                placeholder="Chọn thực phẩm"
                options={foodOptions}
                onChange={setFoodName}
              />

              <SelectField
                label="Bữa"
                value={mealName}
                placeholder="Chọn bữa"
                options={MEAL_OPTIONS}
                onChange={setMealName}
              />

              <DateField
                label="Ngày"
                value={mealDate}
                onChange={setMealDate}
              />

              {editorError ? (
                <FormMessage type="error" message={editorError} />
              ) : null}

              <AppButton
                title="Lưu"
                onPress={save}
                loading={saving}
                disabled={!foodName || !mealName}
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

      <Modal
        visible={suggestOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSuggestOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSuggestOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Gợi ý món từ tủ lạnh</Text>
              <LinkText onPress={() => setSuggestOpen(false)}>Đóng</LinkText>
            </View>
            <Text style={styles.suggestionHint}>
              Ưu tiên nguyên liệu sắp hết hạn để giảm lãng phí.
            </Text>

            {suggestionsQuery.isLoading ? (
              <LoadingState message="Đang tìm món phù hợp..." />
            ) : suggestionsQuery.isError ? (
              <ErrorState
                message={getErrorMessage(suggestionsQuery.error)}
                onRetry={() => void suggestionsQuery.refetch()}
              />
            ) : suggestions.length === 0 ? (
              <View style={styles.suggestionEmpty}>
                <Text style={styles.suggestionEmptyTitle}>
                  Chưa có gợi ý nào
                </Text>
                <Text style={styles.suggestionEmptyText}>
                  Thêm thực phẩm còn hạn vào tủ lạnh và tạo công thức có nguyên
                  liệu tương ứng, sau đó mở lại gợi ý.
                </Text>
                <AppButton
                  title="Mở tủ lạnh"
                  variant="outline"
                  onPress={() => {
                    setSuggestOpen(false);
                    router.navigate('/(tabs)/fridge');
                  }}
                />
                <AppButton
                  title="Xem công thức"
                  variant="outline"
                  style={styles.suggestionEmptyButton}
                  onPress={() => {
                    setSuggestOpen(false);
                    router.push('/recipes');
                  }}
                />
              </View>
            ) : (
              <ScrollView
                style={styles.sheetList}
                showsVerticalScrollIndicator={false}
              >
                {suggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion.id}
                    suggestion={suggestion}
                    isAdmin={isAdmin}
                    onOpenRecipe={() => {
                      setSuggestOpen(false);
                      router.push({
                        pathname: '/recipes/[recipeId]',
                        params: { recipeId: suggestion.id },
                      });
                    }}
                    onAdd={() => addSuggestionToMeal(suggestion)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function MealList({
  items,
  isAdmin,
  deletingId,
  onEdit,
  onDelete,
}: {
  items: MealPlan[];
  isAdmin: boolean;
  deletingId: string | null;
  onEdit: (item: MealPlan) => void;
  onDelete: (item: MealPlan) => void;
}) {
  if (items.length === 0) {
    return <Text style={styles.empty}>Chưa có món nào cho bữa này.</Text>;
  }

  return (
    <>
      {items.map((item, index) => (
        <View
          key={item.id}
          style={[styles.mealRow, index < items.length - 1 && styles.divider]}
        >
          <Thumbnail uri={item.image} label={item.foodName ?? '?'} size={44} />
          <View style={styles.mealBody}>
            <Text style={styles.mealName} numberOfLines={1}>
              {item.foodName ?? 'Không xác định'}
            </Text>
            <Text style={styles.mealMeta} numberOfLines={1}>
              {[item.categoryName, item.unitName]
                .filter(Boolean)
                .join(' · ') || 'Chưa phân loại'}
            </Text>
          </View>

          {isAdmin ? (
            <View style={styles.actions}>
              <LinkText onPress={() => onEdit(item)}>Sửa</LinkText>
              <LinkText onPress={() => onDelete(item)}>
                {deletingId === item.id ? 'Đang xoá...' : 'Xoá'}
              </LinkText>
            </View>
          ) : null}
        </View>
      ))}
    </>
  );
}

function SuggestionRow({
  suggestion,
  isAdmin,
  onOpenRecipe,
  onAdd,
}: {
  suggestion: RecipeSuggestion;
  isAdmin: boolean;
  onOpenRecipe: () => void;
  onAdd: () => void;
}) {
  const missingNames = suggestion.missingIngredients
    .map((ingredient) => ingredient.foodName)
    .filter((name): name is string => Boolean(name));

  return (
    <View style={styles.suggestionRow}>
      <Thumbnail label={suggestion.name} size={44} />

      <View style={styles.mealBody}>
        <Text style={styles.mealName} numberOfLines={1}>
          {suggestion.name}
        </Text>
        <Text style={styles.suggestionReason} numberOfLines={2}>
          {suggestion.reason}
        </Text>
        <Text style={styles.mealMeta} numberOfLines={2}>
          Khớp {suggestion.matchedCount}/{suggestion.totalIngredients} nguyên
          liệu
          {missingNames.length > 0
            ? ` · Thiếu ${missingNames.join(', ')}`
            : ' · Đủ nguyên liệu'}
        </Text>

        <View style={styles.suggestionActions}>
          <LinkText onPress={onOpenRecipe}>Xem công thức</LinkText>
          {isAdmin ? (
            <LinkText onPress={onAdd}>Thêm vào bữa ăn</LinkText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  weekStrip: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  today: {
    borderColor: colors.primary,
  },
  daySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekday: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
  dayNumber: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: 2,
  },
  dayTextSelected: {
    color: colors.onPrimary,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mealBody: {
    flex: 1,
  },
  mealName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  mealMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  suggestionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  suggestionButton: {
    marginBottom: spacing.lg,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    ...typography.heading,
    color: colors.text,
    flex: 1,
  },
  sheetList: {
    marginTop: spacing.xs,
    flexShrink: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionReason: {
    ...typography.caption,
    color: colors.primaryText,
    marginTop: 2,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  suggestionEmpty: {
    paddingVertical: spacing.lg,
  },
  suggestionEmptyTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  suggestionEmptyText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  suggestionEmptyButton: {
    marginTop: spacing.sm,
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
  modalCancel: {
    marginTop: spacing.md,
  },
});
