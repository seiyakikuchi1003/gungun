import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, fonts, radius, spacing } from '@/theme';

/** フォームの入力エラーを出す帯。message が空なら何も描かない */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.wrap}>
      <Ionicons name="alert-circle" size={18} color={colors.heart} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FCEAED', // colors.heart のごく淡い版
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.heart, lineHeight: 20 },
});
