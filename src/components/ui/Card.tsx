import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadows } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing | number;
  muted?: boolean;
  flat?: boolean;
};

/** 白い角丸カード（角丸16px・淡いシャドウ） */
export function Card({ children, style, padding = 'lg', muted = false, flat = false }: Props) {
  const pad = typeof padding === 'number' ? padding : spacing[padding];
  return (
    <View
      style={[
        styles.card,
        { padding: pad, backgroundColor: muted ? colors.cardMuted : colors.card },
        !flat && shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card },
});
