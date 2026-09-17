import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '@/theme';
import { PressableScale } from './PressableScale';
import { lh } from '@/lib/fontScale';

/**
 * 「その工程はもう終わっています」を伝える画面（2026-09-16 指摘）。
 *
 * 通知は押した時点の状態で文面が作られるので、開くころには
 * もう済んでいることがある（評価してください → すでに評価済み、など）。
 * これまでは入力画面をそのまま開き、送信を押して初めて
 * 「すでに評価済みです」と返していた。押す前に分かるようにする。
 *
 * ★ 見つからない（NotFound）とは分けること。
 *   「無い」ではなく「済んでいる」ので、利用者にとっては失敗ではない。
 */
export function AlreadyDone({
  title,
  body,
  /** 取引ID。渡すとその取引の詳細へ戻れるようにする */
  exchangeId,
}: {
  title: string;
  body?: string;
  exchangeId?: string;
}) {
  const insets = useSafeAreaInsets();
  const back = () =>
    router.canGoBack() ? router.back() : router.replace('/exchange' as never);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <PressableScale onPress={back} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
      </View>

      <View style={styles.body}>
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={30} color={colors.white} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.hint}>{body}</Text> : null}
        {exchangeId ? (
          <PressableScale
            onPress={() => router.replace(`/exchange/${exchangeId}` as never)}
            activeScale={0.97}
            style={styles.btn}
          >
            <Text style={styles.btnText}>取引の詳細を見る</Text>
          </PressableScale>
        ) : null}
        <PressableScale onPress={back} activeScale={0.97} style={styles.ghost}>
          <Text style={styles.ghostText}>戻る</Text>
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
  badge: {
    width: 58, height: 58, borderRadius: 999, backgroundColor: colors.green,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary, textAlign: 'center' },
  hint: { fontFamily: fonts.medium, fontSize: 13, lineHeight: lh(20), color: colors.textSecondary, textAlign: 'center' },
  btn: {
    marginTop: spacing.sm, paddingHorizontal: 28, height: 44, justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.green,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  ghost: { paddingHorizontal: 24, height: 40, justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
});
