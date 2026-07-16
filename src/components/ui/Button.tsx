import React from 'react';
import { Text, StyleSheet, ActivityIndicator, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, fonts, shadows } from '@/theme';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'accent' | 'outline' | 'text';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
};

const SIZES: Record<Size, { h: number; fs: number; px: number }> = {
  lg: { h: 60, fs: 17, px: 24 },
  md: { h: 50, fs: 16, px: 20 },
  sm: { h: 40, fs: 14, px: 16 },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  leftIcon,
  style,
  fullWidth = true,
}: Props) {
  const s = SIZES[size];
  const isDisabled = disabled || loading;
  const isFilled = variant === 'primary' || variant === 'accent';

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={isFilled ? colors.white : colors.green} />
      ) : (
        <>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text
            style={[
              { fontFamily: fonts.bold, fontSize: s.fs },
              variant === 'primary' && { color: colors.white },
              variant === 'accent' && { color: colors.white },
              variant === 'outline' && { color: colors.green },
              variant === 'text' && { color: colors.green },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const base: StyleProp<ViewStyle> = [
    styles.base,
    { height: s.h, paddingHorizontal: s.px, borderRadius: radius.pill },
    fullWidth && { alignSelf: 'stretch' },
    isDisabled && { opacity: 0.5 },
    style,
  ];

  if (variant === 'primary' || variant === 'accent') {
    const grad =
      variant === 'primary'
        ? ([colors.green, colors.greenDeep] as const)
        : ([colors.orange, colors.orangeDeep] as const);
    return (
      <PressableScale onPress={isDisabled ? undefined : onPress} style={[base, shadows.button]}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
        />
        {content}
      </PressableScale>
    );
  }

  if (variant === 'outline') {
    return (
      <PressableScale
        onPress={isDisabled ? undefined : onPress}
        style={[base, styles.outline]}
      >
        {content}
      </PressableScale>
    );
  }

  // text
  return (
    <PressableScale onPress={isDisabled ? undefined : onPress} style={[styles.textBtn, style]}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  icon: { justifyContent: 'center', alignItems: 'center' },
  outline: { borderWidth: 1.5, borderColor: colors.green, backgroundColor: 'transparent' },
  textBtn: { paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
});
