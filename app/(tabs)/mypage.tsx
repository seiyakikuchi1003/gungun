import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { StarRating } from '@/components/ui/StarRating';
import { currentUser } from '@/data/mock';

const MENU: { icon: keyof typeof Ionicons.glyphMap; label: string; route?: string; danger?: boolean }[] = [
  { icon: 'person-circle-outline', label: '個人情報設定', route: '/mypage/account' },
  { icon: 'pricetags-outline', label: '出品履歴', route: '/mypage/items' },
  { icon: 'chatbox-ellipses-outline', label: '掲示板投稿履歴', route: '/mypage/posts' },
  { icon: 'ban-outline', label: 'ブロックリスト', route: '/mypage/blocks' },
  { icon: 'information-circle-outline', label: 'ぐんぐんについて' },
  { icon: 'mail-outline', label: 'お問い合わせ' },
  { icon: 'exit-outline', label: 'ログアウト' },
  { icon: 'trash-outline', label: '退会', danger: true },
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
            <Avatar uri={currentUser.avatar} name={currentUser.nickname} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{currentUser.nickname}さん</Text>
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
            <PressableScale key={m.label} activeScale={0.99} onPress={() => m.route && router.push(m.route as never)} style={[styles.menuRow, i < MENU.length - 1 && styles.menuBorder]}>
              <Ionicons name={m.icon} size={22} color={m.danger ? '#D5675C' : colors.green} />
              <Text style={[styles.menuLabel, m.danger && { color: '#D5675C' }]}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textPlaceholder} style={{ marginLeft: 'auto' }} />
            </PressableScale>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
