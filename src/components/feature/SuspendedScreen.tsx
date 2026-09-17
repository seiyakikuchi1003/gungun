import React, { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { useAuth } from '@/store/auth';
import { useTree } from '@/store/tree';
import { lh } from '@/lib/fontScale';

/**
 * 利用停止中の人に出す画面（2026-09-17 指摘）。
 *
 * これまで停止は「書き込みをサーバ側で弾く」だけで、本人には何も知らされず、
 * 出品や投稿を押して初めて失敗していた。管理画面の確認文には
 * 「ログインできなくなります」と書いてあったが、実際にはログインもできた。
 *
 * 一般的なアプリと同じく、停止中はアプリそのものを使えないようにし、
 * 理由と問い合わせ先を見せる。ログアウトだけはできるようにしておく。
 */
export function SuspendedScreen({ reason }: { reason: string | null }) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { settings } = useTree();
  const [busy, setBusy] = useState(false);
  const email = settings.contactEmail;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed" size={30} color={colors.white} />
        </View>
        <Text style={styles.title}>アカウントの利用を停止しています</Text>
        <Text style={styles.lead}>
          利用規約に反する行為が確認されたため、運営によりこのアカウントの利用を停止しました。
          停止中は、出品・水やり・投稿・メッセージなど、すべての機能をお使いいただけません。
        </Text>

        {reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>停止の理由</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ) : null}

        <Text style={styles.note}>
          お心当たりのない場合や、ご不明な点がある場合は、下記までお問い合わせください。
        </Text>
        <PressableScale
          onPress={() => Linking.openURL(`mailto:${email}`).catch(() => {})}
          activeScale={0.97}
          style={styles.contact}
        >
          <Ionicons name="mail-outline" size={18} color={colors.green} />
          <Text style={styles.contactText}>{email}</Text>
        </PressableScale>
      </View>

      <PressableScale
        onPress={async () => {
          if (busy) return;
          setBusy(true);
          try { await signOut(); } finally { setBusy(false); }
        }}
        activeScale={0.97}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>{busy ? 'ログアウトしています…' : 'ログアウト'}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, justifyContent: 'space-between' },
  body: { alignItems: 'center', gap: spacing.md },
  icon: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: colors.textSecondary,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'center' },
  lead: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: lh(22), color: colors.textSecondary, textAlign: 'center' },
  reasonBox: {
    alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 6, marginTop: spacing.sm,
  },
  reasonLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  reasonText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: lh(22), color: colors.textPrimary },
  note: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: lh(20), color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  contact: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, minHeight: 44,
    borderRadius: radius.pill, backgroundColor: colors.greenSoft,
  },
  contactText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  signOut: {
    alignSelf: 'stretch', minHeight: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', paddingVertical: 8,
  },
  signOutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
