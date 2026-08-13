import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { displayName as toDisplayName } from '@/lib/api/map';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Avatar } from '@/components/ui/Avatar';
import { RatingSummary } from '@/components/ui/RatingSummary';
import { FormError } from '@/components/ui/FormError';
import { currentUser } from '@/data/mock';
import { fetchStats, type ProfileStats } from '@/lib/api/profile';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useTree } from '@/store/tree';
import { useMe } from '@/store/me';
import { warning } from '@/lib/haptics';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

type Action = 'about' | 'contact' | 'logout' | 'withdraw';
const MENU: { icon: keyof typeof Ionicons.glyphMap; label: string; route?: string; action?: Action; danger?: boolean }[] = [
  { icon: 'pricetags-outline', label: '出品履歴', route: '/mypage/items' },
  { icon: 'heart-outline', label: 'いいね一覧', route: '/mypage/likes' },
  { icon: 'time-outline', label: '閲覧履歴', route: '/mypage/history' },
  { icon: 'chatbox-ellipses-outline', label: '掲示板の履歴', route: '/mypage/posts' },
  { icon: 'ban-outline', label: 'ブロックリスト', route: '/mypage/blocks' },
  { icon: 'information-circle-outline', label: 'ぐんぐんについて', action: 'about' },
  { icon: 'document-text-outline', label: '利用規約', route: '/mypage/terms' },
  { icon: 'shield-checkmark-outline', label: 'プライバシーポリシー', route: '/mypage/privacy' },
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
  const { signOut, deleteAccount, profile, reloadProfile } = useAuth();
  // 肥料残高は tree ストアが持つ（水やり・チャージで増減する実際の値）
  const { fertilizer, items } = useTree();
  const me = useMe();
  const mine = items.filter((i) => i.ownerId === me.id);
  const planted = mine.filter((i) => i.parentId === null).length;
  const watered = mine.filter((i) => i.parentId !== null).length;
  const exchanging = mine.filter((i) => i.status === 'trading').length;
  // ログイン中の本人の表示名。実DB接続時は profiles の値、モックでは従来どおり。
  // 名乗りを入れていない人は空になる（0030 でローマ字の仮置きをやめた）ので、
  // ここで「名前未設定」と出して編集をうながす。
  const displayName = toDisplayName(profile?.nickname ?? me.nickname);
  // 評価は profile_stats（実データ）から。以前はモックの 4.5 固定だった
  const [stats, setStats] = useState<ProfileStats | null>(null);
  // モック（画面デモ）では従来どおりデモの評価を出す。実データでは profile_stats を使い、
  // 評価がまだ無い人には「評価なし」と出す（4.5 固定を出すと嘘になる）
  const rating =
    stats?.ratingAvg != null
      ? `${stats.ratingAvg}（${stats.ratingCount}）`
      : me.live
        ? '評価なし'
        : `4.5（${currentUser.ratingCount}）`;
  const [sheet, setSheet] = useState<Action | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 評価・肥料・プロフィールをまとめて取り直す。
  // 画面に戻ったとき／アプリを前面に戻したときにも呼ばれる（useAutoRefresh）
  const reloadMine = useCallback(async () => {
    if (!isSupabaseEnabled || !me.live) return;
    await Promise.all([
      fetchStats(me.id).then(setStats).catch(() => {}),
      reloadProfile().catch(() => {}),
    ]);
  }, [me.id, me.live, reloadProfile]);

  useEffect(() => {
    reloadMine();
  }, [reloadMine]);
  useAutoRefresh(reloadMine);

  const onMenu = (m: (typeof MENU)[number]) => {
    if (m.route) { router.push(m.route as never); return; }
    if (m.action) setSheet(m.action);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 170 }}>
        <View style={styles.header}>
          {/* マイページはホームから開くので、戻る導線が無いと
              ボトムナビを経由するしかなかった（2026-08-13 再掲） */}
          <PressableScale
            activeScale={0.9}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </PressableScale>
          <Text style={styles.title}>マイページ</Text>
          {/* 歯車＝設定（本人確認の情報）、名前の横の「編集」＝公開プロフィール。
              どちらもプロフィール編集に飛んでいて役割が重複していた（2026-08-05 指摘） */}
          <PressableScale activeScale={0.9} onPress={() => router.push('/mypage/account')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
          </PressableScale>
        </View>

        {/* プロフィール */}
        <View style={[styles.profile, shadows.card]}>
          <View style={styles.profileTop}>
            <Avatar uri={profile?.avatarUrl ?? me.avatar} name={displayName} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{displayName}さん</Text>
              <PressableScale
                onPress={() => router.push(`/ratings/${me.id}` as never)}
                activeScale={0.97}
                style={styles.ratingRow}
              >
                <RatingSummary avg={stats?.ratingAvg ?? null} count={stats?.ratingCount ?? 0} size={15} />
                <Ionicons name="chevron-forward" size={14} color={colors.textPlaceholder} />
              </PressableScale>
            </View>
            <PressableScale onPress={() => router.push('/mypage/edit')} activeScale={0.95} style={styles.editBtn}>
              <Text style={styles.editText}>編集</Text>
            </PressableScale>
          </View>
          {/* 自己紹介は本人が書いたものを出す。以前は誰でも同じ文言が固定で出ていた（2026-08-05 指摘） */}
          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Text style={[styles.bio, styles.bioEmpty]}>自己紹介はまだありません（編集から書けます）</Text>
          )}
          {/* 固定値ではなく実データから数える（収穫タブの件数と食い違わないように） */}
          <View style={styles.stats}>
            <Stat n={planted} label="植えたタネ" />
            <View style={styles.statDivider} />
            <Stat n={watered} label="水やり" />
            <View style={styles.statDivider} />
            <Stat n={exchanging} label="取引中" />
          </View>
        </View>

        {/* 肥料 */}
        <PressableScale onPress={() => router.push('/fertilizer')} activeScale={0.98} style={[styles.fertRow, shadows.soft]}>
          <View style={styles.fertLeft}>
            <View style={styles.fertIcon}><Ionicons name="leaf" size={18} color={colors.green} /></View>
            <Text style={styles.fertLabel}>肥料残高</Text>
          </View>
          <View style={styles.fertRight}>
            <Text style={styles.fertNum}>{fertilizer.toLocaleString()}</Text>
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
  backBtn: { position: 'absolute', left: 16, padding: 4 },
  profile: { marginHorizontal: 20, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.xl, gap: spacing.md },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  ratingText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  editBtn: { borderWidth: 1.5, borderColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  editText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  bio: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary },
  bioEmpty: { color: colors.textPlaceholder },
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
