import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';
import { StarRating } from './StarRating';

type Props = {
  /** 平均評価。まだ評価が無いときは null */
  avg: number | null;
  /** 評価の件数 */
  count: number;
  /** 併記したい補足（「出品 12」など） */
  suffix?: string;
  size?: number;
  gap?: number;
};

/**
 * 評価の要約表示。
 *
 * ★評価が1件も無いときに星を光らせない。
 *   以前は星の値を 4.5 で決め打ちしていたため、評価0件の相手でも
 *   満点に見えてしまい、取引相手の判断を誤らせる状態だった（2026-08-05 修正）。
 *   件数が 0 のときは星を出さず「評価なし」とだけ伝える。
 */
export function RatingSummary({ avg, count, suffix, size = 13, gap = 2 }: Props) {
  if (count <= 0) {
    return (
      <View style={styles.row}>
        <Text style={styles.muted}>評価なし{suffix ? `・${suffix}` : ''}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.row, { gap: 6 }]}>
      <StarRating value={avg ?? 0} size={size} gap={gap} />
      <Text style={styles.value}>{(avg ?? 0).toFixed(1)}</Text>
      <Text style={styles.muted}>
        ({count}){suffix ? `・${suffix}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  value: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary },
  muted: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
});
