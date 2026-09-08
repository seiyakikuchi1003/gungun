import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

export type TopTab = {
  key: string;
  label: string;
  color?: string;
  /** 対応が必要な件数。1以上で赤い印を出す（見ていないタブの用事に気づけるように） */
  alert?: number;
};

type Props = {
  tabs: TopTab[];
  active: string;
  onChange: (key: string) => void;
};

/** 上部タブ切替（アクティブは下線）。取引の受け取る/送る、履歴の切替などに使う。 */
export function TopTabs({ tabs, active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {tabs.map((t) => {
        const on = t.key === active;
        const accent = t.color ?? colors.green;
        return (
          <PressableScale key={t.key} activeScale={0.97} style={styles.tab} onPress={() => onChange(t.key)}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, on && { color: accent, fontFamily: fonts.bold }]} numberOfLines={1}>{t.label}</Text>
              {!!t.alert && t.alert > 0 && (
                <View style={styles.alert}>
                  <Text style={styles.alertText} maxFontSizeMultiplier={1.2}>{t.alert > 99 ? '99+' : t.alert}</Text>
                </View>
              )}
            </View>
            <View style={[styles.underline, on && { backgroundColor: accent }]} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: colors.card },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alert: {
    // 対応が必要なことを一目で伝える赤。
    // ※ 以前は justifyContent / alignItems が行コメントに巻き込まれていて効いておらず、
    //   数字が中央に来ずに欠けて見えていた（2026-08-21 修正）。
    // 文字サイズを大きくしても数字が収まるよう、高さは伸びられるようにする。
    minWidth: 18,
    minHeight: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: '#E5484D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  underline: { height: 3, width: '60%', borderRadius: 2, backgroundColor: 'transparent' },
});
