import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { qk } from '@/api/queryKeys';
import { tabsApi } from '@/api/tabs.api';
import {
  ErrorState,
  LoadingState,
} from '@/components/ui/StateView';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { colors, radius, spacing, typography } from '@/theme';
import {
  expiryLabel,
  formatMealDate,
  getNextDays,
  todayKey,
} from '@/utils/date';
import { getErrorMessage } from '@/utils/error';
import type { MealPlan, RecipeSuggestion } from '@/types/models';

const mealNames = ['sáng', 'trưa', 'tối'] as const;

export default function MealScreen() {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const days = getNextDays(7);

  const mealsQuery = useQuery({
    queryKey: qk.meals(selectedDate),
    queryFn: () => tabsApi.meals(selectedDate),
  });
  const suggestionsQuery = useQuery({
    queryKey: qk.mealSuggestion,
    queryFn: tabsApi.mealSuggestions,
  });

  const meals = mealsQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];
  const mealItems = (name: (typeof mealNames)[number]) =>
    meals.filter((meal) => meal.name === name);

  return (
    <Screen
      refreshing={mealsQuery.isRefetching || suggestionsQuery.isRefetching}
      onRefresh={() => {
        void mealsQuery.refetch();
        void suggestionsQuery.refetch();
      }}
    >
      <ScreenHeader
        title="Bữa ăn"
        subtitle={formatMealDate(selectedDate)}
      />

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
                style={[styles.dayNumber, selected && styles.dayTextSelected]}
              >
                {day.day}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
            <SectionCard key={name} title={capitalize(name)}>
              <MealList items={mealItems(name)} />
            </SectionCard>
          ))}

          {suggestions.length > 0 ? (
            <SectionCard title="Gợi ý từ tủ lạnh">
              <Text style={styles.suggestionHint}>
                Ưu tiên nguyên liệu sắp hết hạn để giảm lãng phí.
              </Text>
              {suggestions.slice(0, 3).map((suggestion) => (
                <SuggestionRow key={suggestion.id} suggestion={suggestion} />
              ))}
            </SectionCard>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function MealList({ items }: { items: MealPlan[] }) {
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
          <Thumbnail
            uri={item.image}
            label={item.foodName ?? '?'}
            size={44}
          />
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
        </View>
      ))}
    </>
  );
}

function SuggestionRow({ suggestion }: { suggestion: RecipeSuggestion }) {
  return (
    <View style={styles.mealRow}>
      <Thumbnail
        uri={suggestion.image}
        label={suggestion.name}
        size={44}
      />
      <View style={styles.mealBody}>
        <Text style={styles.mealName} numberOfLines={1}>
          {suggestion.name}
        </Text>
        <Text style={styles.mealMeta} numberOfLines={1}>
          {suggestion.foodName ?? 'Không xác định'} ·{' '}
          {expiryLabel(suggestion.expiryDate)}
        </Text>
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
  suggestionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});
