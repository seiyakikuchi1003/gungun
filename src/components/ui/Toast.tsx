import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';

type Props = {
  /** 表示する文言。null なら出さない */
  message: string | null;
  onHide: () => void;
  /** 消えるまでの時間（ms） */
  duration?: number;
};

/**
 * 画面下に少しだけ出る通知。
 * 「コピーしました」など、押した結果が画面に現れない操作のフィードバックに使う。
 */
export function Toast({ message, onHide, duration = 1800 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onHide, duration);
    return () => clearTimeout(t);
  }, [message, duration, onHide]);

  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={styles.wrap}
    >
      <View style={[styles.pill, shadows.card]}>
        <Ionicons name="checkmark-circle" size={17} color={colors.white} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 親の alignItems に影響されないよう、自分で中央寄せする
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center', paddingHorizontal: 20 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(40,48,42,0.94)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  text: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
});
