import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { success } from '@/lib/haptics';
import { useMe } from '@/store/me';
import { useAuth } from '@/store/auth';
import { isSupabaseEnabled } from '@/lib/supabase';
import { fetchAddress, type Address } from '@/lib/api/profile';
import {
  fetchNotificationPrefs,
  saveNotificationPrefs,
  defaultNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/api/profile';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.card, shadows.soft]}>{children}</View>
    </View>
  );
}
function Row({ label, value, onPress, last }: { label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.99} style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textPlaceholder} /> : null}
      </View>
    </PressableScale>
  );
}

const NOTIF: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'watered', label: '水やり' },
  { key: 'harvested', label: '収穫' },
  { key: 'ship', label: '発送・受け取り' },
  { key: 'message', label: '取引メッセージ' },
  { key: 'item_comment', label: '自分の出品へのコメント' },
  { key: 'board', label: '掲示板のコメント' },
];

export default function Account() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { email: authEmail } = useAuth();
  // 通知設定は DB（profiles.notification_prefs）が正。
  // 以前は画面の中だけの状態で、切っても通知が届いていた（2026-08-12 修正）
  const [toggles, setToggles] = useState<NotificationPrefs>(defaultNotificationPrefs);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [mailSheet, setMailSheet] = useState(false);

  // ★ 以前はニックネーム「めたん」／メール「demo@gungun.app」を決め打ちで出していた。
  //   マイページと違う名前が出て「個人情報が一致しない」と見えていた原因。
  const email = authEmail ?? '';
  const [mail, setMail] = useState(email);
  const [address, setAddress] = useState<Address | null>(null);

  useEffect(() => { setMail(email); }, [email]);

  // お届け先・電話番号も「未登録」固定だったので、実データを見に行く
  // 保存して戻ってきたときに読み直す。以前は最初の1回しか読まず、
  // お届け先を登録しても「未登録」のままだった（2026-08-05 指摘）
  const reloadAddress = useCallback(async () => {
    if (!isSupabaseEnabled || !me.live) return;
    try {
      setAddress(await fetchAddress(me.id));
    } catch {
      // 読めなくても画面は保つ
    }
    try {
      setToggles(await fetchNotificationPrefs(me.id));
    } catch {
      // 読めなければ既定のまま
    }
  }, [me.id, me.live]);

  useEffect(() => {
    reloadAddress();
  }, [reloadAddress]);
  useAutoRefresh(reloadAddress);

  const addressLabel = address
    ? `${address.prefecture}${address.city}`
    : '未登録';
  const phoneLabel = address?.phone || '未登録';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.dismissTo('/mypage')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>個人情報設定</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Section title="アカウント">
          {/* ニックネームは公開プロフィール側（マイページの「編集」）に任せる。
              ここに置くと同じ項目が2か所に出て、どちらで直すのか分からなくなる */}
          <Row label="メールアドレス" value={email || '未設定'} onPress={() => setMailSheet(true)} />
          <Row label="パスワード" value="変更する" onPress={() => router.push('/(auth)/reset')} last />
        </Section>

        <Section title="お届け先・連絡先">
          {/* お届け先と電話番号は同じ画面で登録するので、1行にまとめる（2026-08-05 指摘） */}
          <Row
            label="お届け先・電話番号"
            value={address ? `${addressLabel}／${phoneLabel}` : '未登録'}
            onPress={() => router.push('/address')}
            last
          />
        </Section>

        <Section title="通知設定">
          {NOTIF.map((n, i) => (
            <View key={n.key} style={[styles.row, i < NOTIF.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{n.label}</Text>
              <Switch
                value={toggles[n.key]}
                onValueChange={(v) => {
                  const next = { ...toggles, [n.key]: v };
                  setToggles(next);   // 先に画面を動かして、保存は裏で
                  setNotifError(null);
                  if (isSupabaseEnabled && me.live) {
                    saveNotificationPrefs(me.id, next).catch(() => {
                      setToggles(toggles); // 保存できなければ元に戻す
                      setNotifError('通知設定を保存できませんでした');
                    });
                  }
                }}
                trackColor={{ true: colors.green, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>
          ))}
          {notifError ? <Text style={styles.notifError}>{notifError}</Text> : null}
        </Section>
      </ScrollView>

      {/* メールアドレスの変更 */}
      <BottomSheetModal visible={mailSheet} onClose={() => setMailSheet(false)}>
        <Text style={styles.sheetTitle}>メールアドレスの変更</Text>
        <Text style={styles.sheetNote}>新しいアドレスに確認メールを送ります</Text>
        <TextInput
          value={mail}
          onChangeText={setMail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="mail@example.com"
          placeholderTextColor={colors.textPlaceholder}
          style={[styles.sheetInput, { outlineStyle: 'none' } as object]}
        />
        <PressableScale
          onPress={() => { success(); setMailSheet(false); }}
          activeScale={0.97}
          style={[styles.sheetBtn, shadows.button]}
        >
          <Text style={styles.sheetBtnText}>確認メールを送る</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  notifError: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.orangeDeep, paddingHorizontal: 16, paddingBottom: 10 },
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm, marginLeft: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 56 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  sheetNote: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  sheetInput: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  sheetBtn: { height: 52, borderRadius: radius.pill, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  sheetBtnText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
