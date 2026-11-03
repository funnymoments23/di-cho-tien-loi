import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type SelectOption = {
  id: string;
  name: string;
  label?: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

export function SelectField({
  label,
  value,
  placeholder = 'Chọn...',
  options,
  onChange,
  error,
  disabled = false,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter((option) =>
    (option.label ?? option.name)
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const selectedOption = options.find((option) => option.name === value);
  const displayValue = selectedOption?.label ?? value;

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const select = (name: string) => {
    onChange(name);
    close();
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={() => setOpen((current) => !current)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        style={[
          styles.container,
          open && styles.containerOpen,
          error ? styles.containerError : null,
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[styles.value, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {open ? (
        <View style={styles.dropdown}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm..."
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ScrollView
            style={styles.options}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <Text style={styles.empty}>Không có lựa chọn phù hợp.</Text>
            ) : (
              filtered.map((option, index) => {
                const selected = option.name === value;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => select(option.name)}
                    style={[
                      styles.option,
                      index < filtered.length - 1 && styles.optionDivider,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label ?? option.name}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primaryText}
                      />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  container: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  containerOpen: {
    borderColor: colors.primaryText,
  },
  containerError: {
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  value: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.textMuted,
  },
  dropdown: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  search: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  options: {
    maxHeight: 220,
  },
  option: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  optionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
