import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';
import { Sprout } from './Sprout';
import { Mikan } from './Mikan';

type Props = { size?: number; showMascots?: boolean };

/**
 * 「ぐんぐん 🌱 🍊」ロゴ。ログイン画面のヘッダー。
 */
export function GunGunLogo({ size = 48, showMascots = true }: Props) {
  return (
    <View style={styles.row}>
      <Text style={[styles.word, { fontSize: size }]}>ぐんぐん</Text>
      {showMascots && (
        <View style={styles.mascots}>
          <Sprout size={size * 0.62} base />
          <Mikan size={size * 0.92} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  word: {
    fontFamily: fonts.black,
    color: colors.green,
    letterSpacing: 1,
    includeFontPadding: false,
  },
  mascots: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 2 },
});
