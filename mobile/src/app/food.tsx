import { useDeferredValue, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
import { ApiError } from '@/api/client';
import { foodApi } from '@/api/food.api';
import { groupApi } from '@/api/group.api';
import { lookupApi } from '@/api/lookup.api';
import { qk } from '@/api/queryKeys';
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
import { Thumbnail } from '@/components/ui/Thumbnail';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing, typography } from '@/theme';
import { getErrorMessage } from '@/utils/error';
import type { Food } from '@/types/models';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function FoodScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const deferredKeyword = useDeferredValue(keyword);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);

  const foodFilter = {
    ...(deferredKeyword.trim() ? { keyword: deferredKeyword.trim() } : {}),
    ...(categoryFilter ? { categoryName: categoryFilter } : {}),
  };

  const foodsQuery = useQuery({
    queryKey: qk.foods(foodFilter),
    queryFn: () => foodApi.list(foodFilter),
  });
  const categoriesQuery = useQuery({
    queryKey: qk.categories,
    queryFn: lookupApi.categories,
  });
  const unitsQuery = useQuery({
    queryKey: qk.units,
    queryFn: lookupApi.units,
  });
  const groupQuery = useQuery({
    queryKey: qk.groupInfo,
    queryFn: groupApi.info,
    retry: false,
  });

  const foods = foodsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const units = unitsQuery.data ?? [];
  const isGroupAdmin = groupQuery.data?.isAdmin ?? false;
  const noGroup =
    foodsQuery.error instanceof ApiError &&
    (foodsQuery.error.code === '00185' || foodsQuery.error.code === '00096');

  const canManage = (food: Food) =>
    isGroupAdmin || food.createdBy === user?.id;

  const refreshFoods = () => {
    void queryClient.invalidateQueries({ queryKey: qk.foodsRoot });
    void queryClient.invalidateQueries({ queryKey: qk.fridge });
    void queryClient.invalidateQueries({ queryKey: qk.shopping });
    void queryClient.invalidateQueries({ queryKey: qk.mealsRoot });
    void queryClient.invalidateQueries({ queryKey: qk.recipesRoot });
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCategory('');
    setUnit('');
    setImage(null);
    setEditorError('');
    setEditorOpen(true);
  };

  const openEdit = (food: Food) => {
    setEditing(food);
    setName(food.name);
    setCategory(food.categoryName ?? '');
    setUnit(food.unitName ?? '');
    setImage(null);
    setEditorError('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const pickImage = async (source: 'library' | 'camera') => {
    setEditorError('');
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setEditorError(
        source === 'camera'
          ? 'Bạn cần cấp quyền camera để chụp ảnh.'
          : 'Bạn cần cấp quyền thư viện ảnh để chọn ảnh.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      setEditorError('Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    setImage(asset);
  };

  const chooseImage = () => {
    Alert.alert('Ảnh thực phẩm', 'Chọn nguồn ảnh', [
      { text: 'Thư viện', onPress: () => void pickImage('library') },
      { text: 'Chụp ảnh', onPress: () => void pickImage('camera') },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  const imagePart = (asset: ImagePicker.ImagePickerAsset) => {
    const type =
      asset.mimeType && IMAGE_MIME_TYPES.includes(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';
    const extension =
      type === 'image/png'
        ? 'png'
        : type === 'image/webp'
          ? 'webp'
          : type === 'image/gif'
            ? 'gif'
            : 'jpg';

    return {
      uri: asset.uri,
      name: asset.fileName ?? `food-${Date.now()}.${extension}`,
      type,
    } as any;
  };

  const save = async () => {
    setEditorError('');
    const trimmedName = name.trim();

    if (!trimmedName) {
      setEditorError('Vui lòng nhập tên thực phẩm.');
      return;
    }
    if (trimmedName.length > 100) {
      setEditorError('Tên thực phẩm tối đa 100 ký tự.');
      return;
    }
    if (!category) {
      setEditorError('Vui lòng chọn danh mục.');
      return;
    }
    if (!unit) {
      setEditorError('Vui lòng chọn đơn vị.');
      return;
    }

    if (editing) {
      const changed =
        trimmedName !== editing.name ||
        category !== (editing.categoryName ?? '') ||
        unit !== (editing.unitName ?? '') ||
        Boolean(image);

      if (!changed) {
        setEditorError('Chưa có thay đổi nào.');
        return;
      }

      const form = new FormData();
      form.append('foodName', editing.name);
      if (trimmedName !== editing.name) form.append('newName', trimmedName);
      if (category !== (editing.categoryName ?? '')) {
        form.append('newCategory', category);
      }
      if (unit !== (editing.unitName ?? '')) form.append('newUnit', unit);
      if (image) form.append('image', imagePart(image));

      setSaving(true);
      try {
        await foodApi.update(form);
        setEditorOpen(false);
        setNotice(`Đã cập nhật "${trimmedName}".`);
        refreshFoods();
      } catch (err) {
        setEditorError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    const form = new FormData();
    form.append('foodName', trimmedName);
    form.append('categoryName', category);
    form.append('unitName', unit);
    if (image) form.append('image', imagePart(image));

    setSaving(true);
    try {
      await foodApi.create(form);
      setEditorOpen(false);
      setNotice(`Đã thêm "${trimmedName}" vào kho.`);
      refreshFoods();
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (food: Food) => {
    setError('');
    setNotice('');
    setDeletingId(food.id);
    try {
      await foodApi.remove(food.id);
      setNotice(`Đã xoá "${food.name}" khỏi kho.`);
      refreshFoods();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const confirmRemove = (food: Food) => {
    Alert.alert(
      'Xoá thực phẩm',
      `Xoá "${food.name}" khỏi kho? Mục trong tủ lạnh và dữ liệu liên quan cũng sẽ bị xoá.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => void remove(food),
        },
      ]
    );
  };

  return (
    <>
      <Screen
        refreshing={
          foodsQuery.isRefetching ||
          categoriesQuery.isRefetching ||
          unitsQuery.isRefetching
        }
        onRefresh={() => {
          void foodsQuery.refetch();
          void categoriesQuery.refetch();
          void unitsQuery.refetch();
        }}
      >
        <ScreenHeader
          title="Kho thực phẩm"
          subtitle={`${foods.length} thực phẩm trong nhóm`}
          onBack={() => router.back()}
        />

        {notice ? <FormMessage type="success" message={notice} /> : null}
        {error ? <FormMessage type="error" message={error} /> : null}

        <AppInput
          label="Tìm thực phẩm"
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Nhập tên thực phẩm..."
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <FilterChip
            label="Tất cả"
            active={!categoryFilter}
            onPress={() => setCategoryFilter('')}
          />
          {categories.map((item) => (
            <FilterChip
              key={item.id}
              label={item.name}
              active={categoryFilter === item.name}
              onPress={() => setCategoryFilter(item.name)}
            />
          ))}
        </ScrollView>

        {foodsQuery.isLoading ? (
          <LoadingState message="Đang tải kho thực phẩm..." />
        ) : noGroup ? (
          <EmptyState
            title="Bạn chưa tham gia nhóm"
            message="Tạo nhóm hoặc nhờ trưởng nhóm thêm bạn để bắt đầu quản lý kho thực phẩm."
            icon="people-outline"
            action={
              <AppButton
                title="Thiết lập nhóm"
                onPress={() => router.push('/group/setup')}
                variant="outline"
              />
            }
          />
        ) : foodsQuery.isError ? (
          <ErrorState
            message={getErrorMessage(foodsQuery.error)}
            onRetry={() => void foodsQuery.refetch()}
          />
        ) : foods.length === 0 ? (
          <EmptyState
            title="Kho thực phẩm đang trống"
            message="Thêm thực phẩm đầu tiên để dùng khi thêm món vào tủ lạnh."
            icon="nutrition-outline"
            action={
              <AppButton
                title="Thêm thực phẩm"
                onPress={openCreate}
                variant="outline"
              />
            }
          />
        ) : (
          <SectionCard title="Danh sách thực phẩm">
            {foods.map((food, index) => (
              <FoodRow
                key={food.id}
                food={food}
                last={index === foods.length - 1}
                canManage={canManage(food)}
                deleting={deletingId === food.id}
                onEdit={() => openEdit(food)}
                onDelete={() => confirmRemove(food)}
              />
            ))}
          </SectionCard>
        )}

        {!noGroup &&
        !foodsQuery.isLoading &&
        !foodsQuery.isError &&
        foods.length > 0 ? (
          <AppButton
            title="Thêm thực phẩm"
            onPress={openCreate}
            style={styles.addFoodButton}
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
                {editing ? 'Sửa thực phẩm' : 'Thêm thực phẩm'}
              </Text>
              <Text style={styles.modalHint}>
                Tên thực phẩm là duy nhất trong phạm vi nhóm.
              </Text>

              <View style={styles.imageRow}>
                <Thumbnail
                  uri={image?.uri ?? editing?.image ?? null}
                  label={name || '?'}
                  size={88}
                />
                <View style={styles.imageBody}>
                  <Text style={styles.imageTitle}>Ảnh thực phẩm</Text>
                  <View style={styles.imageActions}>
                    <LinkText onPress={chooseImage}>Chọn ảnh</LinkText>
                    <LinkText onPress={() => void pickImage('camera')}>
                      Chụp ảnh
                    </LinkText>
                  </View>
                  <Text style={styles.imageHint}>
                    Tối đa 5MB · JPG, PNG, WEBP, GIF
                  </Text>
                </View>
              </View>

              {categories.length === 0 || units.length === 0 ? (
                <FormMessage
                  type="info"
                  message="Chưa có danh mục hoặc đơn vị. Nhờ quản trị viên tạo trước khi thêm thực phẩm."
                />
              ) : null}

              <AppInput
                label="Tên thực phẩm"
                value={name}
                onChangeText={setName}
                placeholder="Ví dụ: Sữa tươi"
                autoCapitalize="sentences"
                maxLength={100}
                returnKeyType="next"
              />

              <SelectField
                label="Danh mục"
                value={category}
                placeholder="Chọn danh mục"
                options={categories}
                onChange={setCategory}
              />

              <SelectField
                label="Đơn vị"
                value={unit}
                placeholder="Chọn đơn vị"
                options={units}
                onChange={setUnit}
              />

              {editorError ? (
                <FormMessage type="error" message={editorError} />
              ) : null}

              <AppButton
                title="Lưu"
                onPress={save}
                loading={saving}
                disabled={!name.trim() || !category || !unit}
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

function FoodRow({
  food,
  last,
  canManage,
  deleting,
  onEdit,
  onDelete,
}: {
  food: Food;
  last: boolean;
  canManage: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Thumbnail uri={food.image} label={food.name} size={52} />
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[food.categoryName, food.unitName].filter(Boolean).join(' · ') ||
            'Chưa phân loại'}
        </Text>
      </View>

      {canManage ? (
        <View style={styles.actions}>
          <LinkText onPress={onEdit}>Sửa</LinkText>
          <LinkText onPress={onDelete}>
            {deleting ? 'Đang xoá...' : 'Xoá'}
          </LinkText>
        </View>
      ) : null}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addFoodButton: {
    marginTop: spacing.lg,
  },
  chipRow: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.label,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.onAccent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: {
    flex: 1,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
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
    maxHeight: '88%',
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
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  imageBody: {
    flex: 1,
  },
  imageTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  imageActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  imageHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  modalCancel: {
    marginTop: spacing.md,
  },
});
