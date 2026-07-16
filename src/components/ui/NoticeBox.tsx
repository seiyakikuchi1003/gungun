import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, fonts } from '@/theme';
import { Sprout } from '@/components/art/Sprout';

type Props = {
  text: string;
  tone?: 'green' | 'orange';
};

/**
 * 薄い緑/オレンジの案内ボックス（スプラウトアイコン＋テキスト）。
 * タネを植える画面の「いらないものを植えると、交換の輪がはじまります」を再現。
 */
export function NoticeBox({ text, tone = 'green' }: Props) {
  const bg = tone === 'green' ? colors.greenSoft : colors.orangeSoft;
  return (
    <View style={[styles.box, { backgroundColor: bg }]}>
      <Sprout size={22} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.green },
});
