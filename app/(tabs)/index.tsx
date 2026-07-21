import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { MosaicGroup } from '@/components/feature/MosaicGroup';
import { LoginBonusSheet } from '@/components/feature/LoginBonusSheet';
import { Sprout } from '@/components/art/Sprout';
import { Mikan } from '@/components/art/Mikan';
import { WateringCan } from '@/components/art/WateringCan';
import { LeafDecor } from '@/components/art/LeafDecor';
import { currentUser, howToSteps } from '@/data/mock';
import { useTree } from '@/store/tree';

function HeaderIcon({ name, badge, onPress }: { name: keyof typeof Ionicons.glyphMap; badge?: boolean; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.9} style={styles.headerIcon}>
      <Ionicons name={name} size={23} color={colors.textPrimary} />
      {badge && <View style={styles.redDot} />}
    </PressableScale>
  );
}

const STEP_ART: Record<string, React.ReactNode> = {
  sprout: <Sprout size={30} base />,
  water: <WateringCan size={44} />,
  harvest: <Mikan size={30} />,
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items } = useTree();
  const [claimed, setClaimed] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  // 「みんなの種」＝木の根（parentId=null）をテーマ別のモザイクで表示
  const seeds = items.filter((i) => i.parentId === null).reverse();
  const COLLECTIONS: { title: string; subtitle: string; match: (c: string) => boolean }[] = [
    { title: 'スマホ・ガジェット', subtitle: '人気の家電・ゲーム', match: (c) => ['スマホ・家電', '家電', 'ゲーム・おもちゃ'].includes(c) },
    { title: 'ファッション・小物', subtitle: 'バッグ・時計・コスメ', match: (c) => ['レディース', 'メンズ', 'コスメ・美容', 'バッグ・小物'].includes(c) },
    { title: 'ホビー・その他', subtitle: '本・チケット・雑貨', match: (c) => true },
  ];
  // 各種を最初にマッチしたコレクションへ割り当て（最後のグループが受け皿）
  const assigned = new Set<string>();
  const visibleGroups = COLLECTIONS.map((col) => {
    const list = seeds.filter((s) => !assigned.has(s.id) && col.match(s.category));
    list.forEach((s) => assigned.add(s.id));
    return { ...col, items: list };
  }).filter((g) => g.items.length > 0);

  return (
    <View style={styles.root}>
      <View style={styles.leafBg} pointerEvents="none">
        <LeafDecor width={220} height={300} flip opacity={0.35} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 170 }}
      >
        {/* 検索 ＋ 右上アイコン */}
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.push('/search')} activeScale={0.98} style={[styles.search, shadows.soft]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <Text style={styles.searchPlaceholder}>欲しいものを探してみよう</Text>
          </PressableScale>
          <HeaderIcon name="notifications" badge onPress={() => router.push('/notifications')} />
          <HeaderIcon name="swap-horizontal" badge onPress={() => router.push('/exchange')} />
        </View>

        {/* 肥料残高＋ログインボーナス */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
          <LinearGradient
            colors={[colors.green, colors.greenDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fertCard, shadows.card]}
          >
            <View style={styles.fertLeft}>
              <Text style={styles.fertLabel}>現在の肥料</Text>
              <View style={styles.fertRow}>
                <Text style={styles.fertNum}>{currentUser.fertilizer}</Text>
                <Text style={styles.fertUnit}>肥料</Text>
              </View>
            </View>
            <View style={styles.bonusBox}>
              <View>
                <Text style={styles.bonusLabel}>ログインボーナス</Text>
                <Text style={styles.bonusValue}>毎日 +40肥料</Text>
              </View>
              <PressableScale
                onPress={() => { setClaimed(true); setShowBonus(true); }}
                activeScale={0.94}
                style={[styles.claimBtn, claimed && styles.claimBtnDone]}
              >
                <Text style={[styles.claimText, claimed && styles.claimTextDone]}>
                  {claimed ? '受取済' : '受け取る'}
                </Text>
              </PressableScale>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* みんなの種（テーマ別モザイク） */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <Sprout size={20} />
              <Text style={styles.sectionTitle}>みんなの種</Text>
            </View>
            <PressableScale onPress={() => router.push('/search')}>
              <Text style={styles.seeAll}>すべて見る ›</Text>
            </PressableScale>
          </View>
          {visibleGroups.map((g) => (
            <MosaicGroup
              key={g.title}
              title={g.title}
              subtitle={g.subtitle}
              items={g.items}
              width={width}
              onPressItem={(item) => router.push(`/item/${item.id}`)}
            />
          ))}
        </Animated.View>

        {/* ぐんぐんの楽しみ方 */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={[styles.section, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>ぐんぐんの楽しみ方</Text>
          <View style={[styles.howCard, shadows.card]}>
            {howToSteps.map((step, i) => (
              <React.Fragment key={step.key}>
                <View style={styles.step}>
                  <View style={styles.stepArt}>{STEP_ART[step.icon]}</View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
                {i < howToSteps.length - 1 && (
                  <Ionicons name="chevron-forward" size={18} color={colors.greenSoftBorder} />
                )}
              </React.Fragment>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* 「タネを植える」FAB（右下・ラベル付き拡張FAB） */}
      <PressableScale
        onPress={() => router.push('/plant/seed')}
        accessibilityLabel="タネを植える（出品する）"
        style={[styles.fab, shadows.button]}
      >
        <View style={styles.fabIcon}>
          <Sprout size={20} color={colors.white} />
        </View>
        <Text style={styles.fabText}>タネを植える</Text>
      </PressableScale>

      {/* ログインボーナスのスタンプカレンダー */}
      <LoginBonusSheet visible={showBonus} claimedToday={claimed} onClose={() => setShowBonus(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  leafBg: { position: 'absolute', right: -40, top: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 20, marginBottom: spacing.lg },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    height: 46,
    paddingHorizontal: spacing.lg,
  },
  searchPlaceholder: { fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPlaceholder },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  redDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.heart,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  section: { paddingHorizontal: 20, marginBottom: spacing['2xl'] },
  fertCard: { borderRadius: radius.lg, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  fertLeft: { flex: 1 },
  fertLabel: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  fertRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 },
  fertNum: { fontFamily: fonts.black, fontSize: 38, color: colors.white, includeFontPadding: false },
  fertUnit: { fontFamily: fonts.bold, fontSize: 16, color: colors.white, marginBottom: 6 },
  bonusBox: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  bonusLabel: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  bonusValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  claimBtn: { backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill },
  claimBtnDone: { backgroundColor: 'rgba(255,255,255,0.3)' },
  claimText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  claimTextDone: { color: colors.white },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary },
  seeAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 8 },
  howCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: { alignItems: 'center', gap: 4, width: 84 },
  stepArt: { height: 40, justifyContent: 'center', alignItems: 'center' },
  stepTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  stepDesc: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textSecondary, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    paddingLeft: 8,
    paddingRight: 22,
    borderRadius: 27,
    backgroundColor: colors.greenDeep,
  },
  fabIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
