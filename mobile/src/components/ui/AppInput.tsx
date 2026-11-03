import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, fonts, radius, spacing, typography } from '@/theme';

type AppInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  error?: string;
  secure?: boolean;
};

export function AppInput({
  label,
  error,
  secure = false,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...inputProps
}: AppInputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.container,
          focused && styles.containerFocused,
          error ? styles.containerError : null,
        ]}
      >
        <TextInput
          {...inputProps}
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primaryText}
          secureTextEntry={secure ? hidden : false}
          style={[styles.input, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />

        {secure ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
          >
            <Text style={styles.toggle}>{hidden ? 'Hiện' : 'Ẩn'}</Text>
          </Pressable>
        ) : null}
      </View>

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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  containerFocused: {
    borderColor: colors.primaryText,
  },
  containerError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 0,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 17,
  },
  toggle: {
    ...typography.label,
    fontSize: 13,
    color: colors.primaryText,
    paddingLeft: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
