import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

export type TopTab = { key: string; label: string; color?: string };

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
            <Text style={[styles.label, on && { color: accent, fontFamily: fonts.bold }]}>{t.label}</Text>
            <View style={[styles.underline, on && { backgroundColor: accent }]} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  underline: { height: 3, width: '60%', borderRadius: 2, backgroundColor: 'transparent' },
});
