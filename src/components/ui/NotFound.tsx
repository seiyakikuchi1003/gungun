import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '@/theme';
import { PressableScale } from './PressableScale';

/**
 * 対象が見つからないときの画面。
 *
 * ★必ず戻る手段を出すこと。
 *   以前は空の View を返しており、真っ白な画面でヘッダーも戻るボタンも無く、
 *   アプリを終了するしかない状態になっていた（通知から古い取引を開いたときに発生）。
 */
export function NotFound({
  message = '見つかりませんでした',
  hint,
  /** 戻る先。履歴が無いとき（通知から直接開いたときなど）に使う */
  fallback = '/(tabs)',
}: {
  message?: string;
  hint?: string;
  fallback?: string;
}) {
  const insets = useSafeAreaInsets();
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback as never));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <PressableScale onPress={back} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
      </View>

      <View style={styles.body}>
        <Ionicons name="leaf-outline" size={44} color={colors.textPlaceholder} />
        <Text style={styles.title}>{message}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <PressableScale onPress={back} activeScale={0.97} style={styles.btn}>
          <Text style={styles.btnText}>戻る</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: 32, paddingBottom: 80 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, textAlign: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  btn: {
    marginTop: spacing.sm, paddingHorizontal: 28, height: 44, justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.green,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
