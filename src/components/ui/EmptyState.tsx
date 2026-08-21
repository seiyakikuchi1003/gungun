import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing } from '@/theme';
import { PressableScale } from './PressableScale';

/**
 * 「まだ何もない」状態の共通表示。
 *
 * 一覧が空のときに真っ白な画面になると、壊れているのか空なのか分からない。
 * アイコン・見出し・ひとこと（＋任意の導線）で「空であること」を伝える。
 */
export function EmptyState({
  icon = 'leaf-outline',
  title,
  note,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Ionicons name={icon} size={30} color={colors.green} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} activeScale={0.96} style={styles.btn}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // alignItems:'center' は子を内容幅に縮めるので、ボタンには自前で幅を持たせている
  wrap: { paddingTop: 56, paddingBottom: 40, paddingHorizontal: 32, alignItems: 'center' },
  circle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.greenSoft,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary, textAlign: 'center' },
  note: {
    fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, color: colors.textSecondary,
    textAlign: 'center', marginTop: 6,
  },
  btn: {
    marginTop: spacing.lg, minWidth: 200, height: 46, borderRadius: 23,
    backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center',
  },
  btnText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.white },
});
