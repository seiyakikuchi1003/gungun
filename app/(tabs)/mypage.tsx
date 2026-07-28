import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Avatar } from '@/components/ui/Avatar';
import { StarRating } from '@/components/ui/StarRating';
import { FormError } from '@/components/ui/FormError';
import { currentUser } from '@/data/mock';
import { useAuth } from '@/store/auth';
import { warning } from '@/lib/haptics';

type Action = 'about' | 'contact' | 'logout' | 'withdraw';
const MENU: { icon: keyof typeof Ionicons.glyphMap; label: string; route?: string; action?: Action; danger?: boolean }[] = [
  { icon: 'person-circle-outline', label: '個人情報設定', route: '/mypage/account' },
  { icon: 'pricetags-outline', label: '出品履歴', route: '/mypage/items' },
  { icon: 'chatbox-ellipses-outline', label: '掲示板投稿履歴', route: '/mypage/posts' },
  { icon: 'ban-outline', label: 'ブロックリスト', route: '/mypage/blocks' },
  { icon: 'information-circle-outline', label: 'ぐんぐんについて', action: 'about' },
  { icon: 'mail-outline', label: 'お問い合わせ', action: 'contact' },
  { icon: 'exit-outline', label: 'ログアウト', action: 'logout' },
  { icon: 'trash-outline', label: '退会', action: 'withdraw', danger: true },
];

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function MyPage() {
  const insets = useSafeAreaInsets();
  const { signOut, deleteAccount, profile } = useAuth();
  // ログイン中の本人の表示名。実DB接続時は profiles の値、モックでは従来どおり。
  // ※ ID や所有判定はまだモック（currentUser.id）のまま。商品データの実DB化と一緒に切り替える。
  const displayName = profile?.nickname ?? currentUser.nickname;
  const [sheet, setSheet] = useState<Action | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onMenu = (m: (typeof MENU)[number]) => {
    if (m.route) { router.push(m.route as never); return; }
    if (m.action) setSheet(m.action);
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 170 }}>
        <View style={styles.header}>
          <Text style={styles.title}>マイページ</Text>
          <PressableScale activeScale={0.9} onPress={() => router.push('/mypage/edit')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </PressableScale>
        </View>

        {/* プロフィール */}
        <View style={[styles.profile, shadows.card]}>
          <View style={styles.profileTop}>
            <Avatar uri={profile?.avatarUrl ?? currentUser.avatar} name={displayName} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}さん</Text>
              <View style={styles.ratingRow}>
                <StarRating value={4.5} size={15} />
                <Text style={styles.ratingText}>4.5（{currentUser.ratingCount}）</Text>
              </View>
            </View>
            <PressableScale onPress={() => router.push('/mypage/edit')} activeScale={0.95} style={styles.editBtn}>
              <Text style={styles.editText}>編集</Text>
            </PressableScale>
          </View>
          <Text style={styles.bio}>不要になったものを、必要な人へ🌱 気軽に水やりしてください！</Text>
          <View style={styles.stats}>
            <Stat n={2} label="植えたタネ" />
            <View style={styles.statDivider} />
            <Stat n={7} label="水やり" />
            <View style={styles.statDivider} />
            <Stat n={3} label="収穫" />
          </View>
        </View>

        {/* 肥料 */}
        <PressableScale onPress={() => router.push('/fertilizer')} activeScale={0.98} style={[styles.fertRow, shadows.soft]}>
          <View style={styles.fertLeft}>
            <View style={styles.fertIcon}><Ionicons name="leaf" size={18} color={colors.green} /></View>
            <Text style={styles.fertLabel}>肥料残高</Text>
          </View>
          <View style={styles.fertRight}>
            <Text style={styles.fertNum}>{currentUser.fertilizer}</Text>
            <Text style={styles.fertUnit}>肥料</Text>
            <Text style={styles.charge}>チャージ ›</Text>
          </View>
        </PressableScale>

        {/* メニュー */}
        <View style={[styles.menu, shadows.soft]}>
          {MENU.map((m, i) => (
            <PressableScale key={m.label} activeScale={0.99} onPress={() => onMenu(m)} style={[styles.menuRow, i < MENU.length - 1 && styles.menuBorder]}>
              <Ionicons name={m.icon} size={22} color={m.danger ? '#D5675C' : colors.green} />
              <Text style={[styles.menuLabel, m.danger && { color: '#D5675C' }]}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textPlaceholder} style={{ marginLeft: 'auto' }} />
            </PressableScale>
          ))}
        </View>
      </ScrollView>

      {/* ぐんぐんについて */}
      <BottomSheetModal visible={sheet === 'about'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>ぐんぐんについて</Text>
        <Text style={styles.sheetBody}>
          「ぐんぐん」は、いらなくなったものを植えて、みんなの水やり（交換希望）で育て、
          わらしべ長者のように交換の輪をつくるC2Cアプリです。{'\n\n'}バージョン 1.0.0（プレビュー）
        </Text>
        <PressableScale onPress={() => setSheet(null)} activeScale={0.97} style={[styles.sheetBtn, shadows.button]}>
          <Text style={styles.sheetBtnText}>閉じる</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* お問い合わせ */}
      <BottomSheetModal visible={sheet === 'contact'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>お問い合わせ</Text>
        <Text style={styles.sheetBody}>
          ご不明な点・不具合のご報告は、以下までお気軽にご連絡ください。
        </Text>
        <PressableScale
          onPress={() => { Linking.openURL('mailto:support@gungun.app').catch(() => {}); setSheet(null); }}
          activeScale={0.97}
          style={[styles.sheetBtn, shadows.button]}
        >
          <Ionicons name="mail" size={18} color={colors.white} />
          <Text style={styles.sheetBtnText}>support@gungun.app にメール</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* ログアウト */}
      <BottomSheetModal visible={sheet === 'logout'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>ログアウトしますか？</Text>
        <PressableScale
          onPress={async () => { setSheet(null); await signOut(); router.replace('/(auth)/login'); }}
          activeScale={0.97}
          style={[styles.sheetBtn, shadows.button]}
        >
          <Text style={styles.sheetBtnText}>ログアウト</Text>
        </PressableScale>
        <PressableScale onPress={() => setSheet(null)} activeScale={0.98} style={styles.sheetCancel}>
          <Text style={styles.sheetCancelText}>キャンセル</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* 退会 */}
      <BottomSheetModal visible={sheet === 'withdraw'} onClose={() => setSheet(null)}>
        <Text style={styles.sheetTitle}>本当に退会しますか？</Text>
        <Text style={styles.sheetBody}>
          退会すると、出品・水やり・肥料などのデータがすべて削除され、元に戻せません。
        </Text>
        <FormError message={deleteError} />
        <PressableScale
          onPress={async () => {
            warning();
            setSheet(null);
            // 実DB接続時はアカウントごと削除（RPC）。モックではログアウトのみ。
            const res = await deleteAccount();
            if (res.error) { setDeleteError(res.error); return; }
            router.replace('/(auth)/login');
          }}
          activeScale={0.97}
          style={[styles.sheetDanger, shadows.button]}
        >
          <Text style={styles.sheetBtnText}>退会する</Text>
        </PressableScale>
        <PressableScale onPress={() => setSheet(null)} activeScale={0.98} style={styles.sheetCancel}>
          <Text style={styles.sheetCancelText}>キャンセル</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  sheetBody: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: spacing.lg },
  sheetBtn: { flexDirection: 'row', gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  sheetDanger: { height: 54, borderRadius: radius.pill, backgroundColor: '#D5675C', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  sheetBtnText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.white },
  sheetCancel: { height: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs },
  sheetCancelText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary },
  settingsBtn: { position: 'absolute', right: 20, padding: 4 },
  profile: { marginHorizontal: 20, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.xl, gap: spacing.md },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  ratingText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  editBtn: { borderWidth: 1.5, borderColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  editText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  bio: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgWarm, borderRadius: radius.md, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontFamily: fonts.black, fontSize: 22, color: colors.green },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  fertRow: { marginHorizontal: 20, marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fertLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fertIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  fertLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  fertRight: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  fertNum: { fontFamily: fonts.black, fontSize: 22, color: colors.textPrimary },
  fertUnit: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  charge: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.green, marginLeft: spacing.sm },
  menu: { marginHorizontal: 20, marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
});
