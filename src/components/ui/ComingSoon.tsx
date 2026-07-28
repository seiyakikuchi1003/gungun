import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from './Screen';
import { Mikan } from '@/components/art/Mikan';
import { colors, fonts, spacing } from '@/theme';

/** モック段階の未実装タブ用プレースホルダー。 */
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.center}>
          <Mikan size={110} />
          <Text style={styles.msg}>ただいま準備中です</Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: spacing.lg, alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, marginTop: -60 },
  msg: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginTop: spacing.lg },
  note: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
