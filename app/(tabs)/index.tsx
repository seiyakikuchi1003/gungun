import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { RefreshSpinner } from '@/components/ui/RefreshSpinner';
import { MosaicGroup } from '@/components/feature/MosaicGroup';
import { LoginBonusSheet } from '@/components/feature/LoginBonusSheet';
import { Sprout } from '@/components/art/Sprout';
import { Mikan } from '@/components/art/Mikan';
import { WateringCan } from '@/components/art/WateringCan';
import { LeafDecor } from '@/components/art/LeafDecor';
import { currentUser, howToSteps } from '@/data/mock';
import { useTree } from '@/store/tree';
import { medium } from '@/lib/haptics';
import { playSfx, preloadSfx } from '@/lib/sound';

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
  React.useEffect(() => { preloadSfx(); }, []); // 初回再生の遅延を減らす

  // ── 引っ張って更新（X/インスタ風の pull-to-refresh）──────────
  // モックでは並びを回転させて「新しい内容が届いた」感を出す
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const scrollY = useSharedValue(0); // 引っ張り量 → カスタムスピナーの回転に連動
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    medium(); // 引っ張った瞬間の「トン」
    preloadSfx();
    setTimeout(() => {
      setRefreshTick((t) => t + 1);
      setRefreshing(false);
      playSfx('pop'); // 更新完了の「プチッ」
    }, 1300);
  }, []);

  // 「みんなの種」＝木の根（parentId=null）をテーマ別のモザイクで表示
  const seedsBase = items.filter((i) => i.parentId === null).reverse();
  const shift = refreshTick % Math.max(seedsBase.length, 1);
  const seeds = seedsBase.slice(shift).concat(seedsBase.slice(0, shift));
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

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 170 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={[colors.green]}
            progressViewOffset={insets.top + 8}
          />
        }
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
            colors={['#3AB16E', colors.green, colors.greenDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fertCard, shadows.card]}
          >
            {/* 背景の淡い装飾（葉の丸） */}
            <View pointerEvents="none" style={styles.fertGlow} />
            <View pointerEvents="none" style={styles.fertLeaf}>
              <LeafDecor width={130} height={150} opacity={0.14} />
            </View>

            <View style={styles.fertTopRow}>
              <View style={styles.fertBadge}>
                <Ionicons name="leaf" size={15} color={colors.white} />
              </View>
              <Text style={styles.fertLabel}>現在の肥料</Text>
            </View>
            <View style={styles.fertRow}>
              <Text style={styles.fertNum}>{currentUser.fertilizer.toLocaleString()}</Text>
              <Text style={styles.fertUnit}>肥料</Text>
            </View>

            {/* ログインボーナス行 */}
            <View style={styles.bonusRow}>
              <View style={styles.bonusInfo}>
                <Ionicons name="gift" size={16} color={colors.white} />
                <Text style={styles.bonusText}>ログインボーナス　毎日 +40</Text>
              </View>
              <PressableScale
                onPress={() => { setClaimed(true); setShowBonus(true); }}
                activeScale={0.94}
                style={[styles.claimBtn, claimed && styles.claimBtnDone]}
              >
                {claimed ? (
                  <>
                    <Ionicons name="checkmark" size={15} color={colors.white} />
                    <Text style={[styles.claimText, styles.claimTextDone]}>受取済</Text>
                  </>
                ) : (
                  <Text style={styles.claimText}>受け取る</Text>
                )}
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
          {/* 更新のたびに key が変わり、新しい並びがふわっと入れ替わる */}
          <Animated.View key={refreshTick} entering={FadeIn.duration(420)}>
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

      </Animated.ScrollView>

      {/* X風のカスタム更新スピナー（引っ張りに連動して回転） */}
      <RefreshSpinner pullY={scrollY} refreshing={refreshing} topOffset={insets.top + 6} />

      {/* 「タネを植える」FAB（右下・ラベル付き拡張FAB） */}
      <PressableScale
        onPress={() => router.push('/plant/seed')}
        accessibilityLabel="タネを植える（出品する）"
        activeScale={0.96}
        style={styles.fabWrap}
      >
        <LinearGradient
          colors={[colors.green, colors.greenDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fab, shadows.button]}
        >
          <View style={styles.fabIcon}>
            <Sprout size={20} color={colors.green} />
          </View>
          <Text style={styles.fabText}>タネを植える</Text>
        </LinearGradient>
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
  fertCard: { borderRadius: 24, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, overflow: 'hidden' },
  fertGlow: { position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)' },
  fertLeaf: { position: 'absolute', right: -10, bottom: -20 },
  fertTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  fertBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' },
  fertLabel: { fontFamily: fonts.bold, fontSize: 13, color: 'rgba(255,255,255,0.92)' },
  fertRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 4, marginBottom: spacing.md },
  fertNum: { fontFamily: fonts.black, fontSize: 44, color: colors.white, includeFontPadding: false, letterSpacing: -0.5 },
  fertUnit: { fontFamily: fonts.bold, fontSize: 16, color: 'rgba(255,255,255,0.92)', marginBottom: 8 },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    paddingVertical: 6,
  },
  bonusInfo: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  bonusText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  claimBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.white, paddingHorizontal: 18, height: 38, borderRadius: radius.pill, justifyContent: 'center', ...shadows.soft },
  claimBtnDone: { backgroundColor: 'rgba(255,255,255,0.28)' },
  claimText: { fontFamily: fonts.black, fontSize: 13.5, color: colors.greenDeep },
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
  fabWrap: { position: 'absolute', right: 20, bottom: 26 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 58,
    paddingLeft: 8,
    paddingRight: 24,
    borderRadius: 29,
  },
  fabIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  fabText: { fontFamily: fonts.black, fontSize: 15.5, color: colors.white, letterSpacing: 0.2 },
});
