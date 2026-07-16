import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fonts, shadows } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  password?: boolean;
  error?: string;
};

/**
 * ラベル付き入力欄。左アイコン・パスワードの目のトグル・エラー表示に対応。
 * 画像のログイン/新規登録の白いカード型インプットを再現。
 */
export function TextField({ label, leftIcon, password, error, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!password);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          shadows.soft,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {leftIcon ? (
          <Ionicons name={leftIcon} size={22} color={colors.green} style={styles.left} />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textPlaceholder}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, style]}
          {...rest}
        />
        {password ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.input,
    height: 62,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: spacing.md,
  },
  fieldFocused: { borderColor: colors.greenSoftBorder },
  fieldError: { borderColor: '#E4796F' },
  left: { marginRight: 2 },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    height: '100%',
  },
  errorText: { fontFamily: fonts.regular, fontSize: 12, color: '#D5675C', marginLeft: 4 },
});
