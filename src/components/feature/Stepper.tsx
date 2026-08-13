import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '@/theme';
import { STEPS } from '@/lib/exchangeStatus';

/**
 * 取引の進み具合（収穫→発送→受取→評価→完了）。
 *
 * 「いま自分がどこにいるか」が一目で分かるようにするための帯。
 * 済んだ段は緑の丸＋チェック、今の段はオレンジの丸、これからは灰色。
 *
 * current は小数を取り得る（3.5＝評価の段だが相手待ち）。
 * 進み具合として「評価の丸は今の位置」に見せたいので Math.floor で丸める。
 */
export function Stepper({ current }: { current: number }) {
  const at = Math.floor(current);
  return (
    <View style={styles.row}>
      {STEPS.map((label, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <View key={label} style={styles.cell}>
            <View style={styles.lineWrap}>
              {/* 左右の線。両端は描かない */}
              <View style={[styles.line, i === 0 && styles.hidden, done || now ? styles.lineOn : null]} />
              <View style={[styles.dot, done && styles.dotDone, now && styles.dotNow]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                ) : (
                  <Text style={[styles.dotNum, now && styles.dotNumNow]}>{i + 1}</Text>
                )}
              </View>
              <View style={[styles.line, i === STEPS.length - 1 && styles.hidden, done ? styles.lineOn : null]} />
            </View>
            <Text style={[styles.label, (done || now) && styles.labelOn]} numberOfLines={1}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md },
  cell: { flex: 1, alignItems: 'center', gap: 6 },
  lineWrap: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2, backgroundColor: colors.divider },
  lineOn: { backgroundColor: colors.green },
  hidden: { backgroundColor: 'transparent' },
  dot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cardMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  dotDone: { backgroundColor: colors.green },
  dotNow: { backgroundColor: colors.orange },
  dotNum: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary },
  dotNumNow: { color: colors.white },
  label: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary },
  labelOn: { fontFamily: fonts.bold, color: colors.textPrimary },
});
