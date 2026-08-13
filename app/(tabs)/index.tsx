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
import { ExpandableFab } from '@/components/ui/ExpandableFab';
import { LoginBonusSheet } from '@/components/feature/LoginBonusSheet';
import { Sprout } from '@/components/art/Sprout';
import { Mikan } from '@/components/art/Mikan';
import { GiftBox } from '@/components/art/GiftBox';
import { WateringCan } from '@/components/art/WateringCan';
import { LeafDecor } from '@/components/art/LeafDecor';
import { howToSteps } from '@/data/mock';
import { useTree } from '@/store/tree';
import { useBlocks } from '@/store/blocks';
import { useNotifications } from '@/store/notifications';
import { medium, success } from '@/lib/haptics';
import { playSfx, preloadSfx } from '@/lib/sound';
import { useMe } from '@/store/me';
import { useLoginBonus } from '@/hooks/useLoginBonus';
import { useExchanges } from '@/hooks/useExchanges';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

/**
 * ヘッダーのアイコン。未読件数を数字で出す（点だけだと何件あるか分からない）。
 * 99件を超えたら「99+」に丸める。
 */
function HeaderIcon({
  name,
  count = 0,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  count?: number;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} activeScale={0.9} style={styles.headerIcon}>
      <Ionicons name={name} size={23} color={colors.textPrimary} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const STEP_ART: Record<string, React.ReactNode> = {
  sprout: <Sprout size={30} base />,
  water: <WateringCan size={44} />,
  harvest: <Mikan size={30} />,
};

/** 固定した上部バーの高さ（検索欄 46 ＋ 下の余白 16） */
const TOP_BAR_H = 62;

export default function HomeScreen() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // 肥料残高は tree ストアが持つ（水やり・チャージ・ボーナスで増減する実際の値）
  const { items, fertilizer, refresh } = useTree();
  // 画面に戻ったとき・アプリを前面に戻したときに最新を取り直す
  useAutoRefresh(refresh);
  const { isBlocked } = useBlocks();
  const { unreadCount } = useNotifications();
  // 取引アイコンのバッジ。以前は常時点灯（badge 固定）だったので、
  // 「まだ発送・受け取りが終わっていない取引」の件数に変えた
  const { list: trades } = useExchanges();
  const activeTrades = trades.filter((t) => t.status !== 'received').length;
  const { claimed, busy: bonusBusy, amount: bonusAmount, claim } = useLoginBonus();
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
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    medium(); // 引っ張った瞬間の「トン」
    preloadSfx();
    // 実データを取り直す。以前はここで待つだけで並べ替えしかしておらず、
    // 他の人が出した新しいタネが引っ張っても出てこなかった（2026-08-05 修正）
    const started = Date.now();
    try {
      await refresh();
    } catch {
      // 取得に失敗しても画面は保つ（オフラインでも操作を止めない）
    }
    // 速すぎると更新された感じがしないので、最低限アニメーションを見せる
    const rest = Math.max(0, 700 - (Date.now() - started));
    setTimeout(() => {
      setRefreshTick((t) => t + 1);
      setRefreshing(false);
      playSfx('pop'); // 更新完了の「プチッ」
    }, rest);
  }, [refresh]);

  // 「みんなの種」＝木の根（parentId=null）をテーマ別のモザイクで表示
  // 収穫が決まった（取引中・完了）ものはホームに出さない。
  // 出しておくと水やりできそうに見えるが、実際には受け付けられない（2026-08-05 指摘）
  const seedsBase = items
    .filter((i) => i.parentId === null && i.status === 'growing' && !isBlocked(i.ownerId))
    .reverse();
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

      {/* 検索・通知・マイページは上部に固定する。
          スクロールで流れると、探したいときに毎回いちばん上まで戻る必要があった（2026-08-12 指摘） */}
      <View style={[styles.topBarFixed, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.push('/search')} activeScale={0.98} style={[styles.search, shadows.soft]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <Text style={styles.searchPlaceholder}>欲しいものを探してみよう</Text>
          </PressableScale>
          <HeaderIcon name="notifications" count={unreadCount} onPress={() => router.push('/notifications')} />
          {/* 取引はボトムナビに移したので、ここはマイページへの導線にする（2026-08-13） */}
          <HeaderIcon name="person-circle-outline" count={0} onPress={() => router.navigate('/mypage')} />
        </View>
      </View>

      <Animated.ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8 + TOP_BAR_H, paddingBottom: 170 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={[colors.green]}
            progressViewOffset={insets.top + 8 + TOP_BAR_H}
          />
        }
      >
        {/* 肥料残高／ログインボーナス（白いカード2枚を横並び） */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.section, styles.cardsRow]}>
          {/* 左：現在の肥料 */}
          <View style={[styles.infoCard, shadows.card]}>
            <View pointerEvents="none" style={styles.cardLeaf}>
              <LeafDecor width={74} height={88} opacity={0.35} />
            </View>
            <Text style={styles.infoLabel}>現在の肥料</Text>
            <View style={styles.fertBody}>
              <Sprout size={44} base />
              <View style={styles.fertNumRow}>
                <Text style={styles.fertNum}>{fertilizer.toLocaleString()}</Text>
                <Text style={styles.fertUnit}>肥料</Text>
              </View>
            </View>
          </View>

          {/* 右：ログインボーナス */}
          <View style={[styles.infoCard, shadows.card]}>
            <Text style={styles.infoLabel}>ログインボーナス</Text>
            <View style={styles.bonusBody}>
              <GiftBox size={46} />
              <Text style={styles.bonusValue}>毎日{'\n'}+{bonusAmount}肥料</Text>
            </View>
            <PressableScale
              onPress={async () => {
                // 受取済みでもカレンダーは見たい（押しても何も起きないのは不親切）
                if (!claimed) {
                  await claim();
                  success(); // 受け取れた手応えを返す
                }
                setShowBonus(true);
              }}
              activeScale={0.95}
              disabled={bonusBusy}
            >
              <LinearGradient
                colors={claimed ? ['#D9D3C6', '#CFC8BA'] : ['#F7B23F', colors.orangeDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.claimBtn, !claimed && shadows.soft]}
              >
                <Text style={styles.claimText}>{claimed ? '受取済' : '受け取る'}</Text>
                <Ionicons
                  name={claimed ? 'checkmark' : 'chevron-forward'}
                  size={15}
                  color={colors.white}
                />
              </LinearGradient>
            </PressableScale>
          </View>
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

      {/* 「タネを植える」FAB（スクロールで畳まれる拡張FAB） */}
      <ExpandableFab
        scrollY={scrollY}
        onPress={() => router.push('/plant/seed')}
        label="タネを植える"
        icon={<Sprout size={24} color={colors.white} />}
        labelWidth={118}
        bottom={26}
      />

      {/* ログインボーナスのスタンプカレンダー */}
      <LoginBonusSheet visible={showBonus} claimedToday={claimed} amount={bonusAmount} onClose={() => setShowBonus(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBarFixed: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: colors.bg,
  },
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' }, // 装飾の葉が右にはみ出す設計なので、ここで切る（全画面で横スクロールが出ていた）
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
  badge: {
    position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, borderRadius: 8.5,
    backgroundColor: '#E4796F', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.bg,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white, lineHeight: 13 },
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
  // 肥料／ボーナスの2枚カード
  cardsRow: { flexDirection: 'row', gap: 12 },
  infoCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  cardLeaf: { position: 'absolute', right: -26, bottom: -30 },
  infoLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  // 左カード
  fertBody: { alignItems: 'center', marginTop: 2 },
  fertNumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 },
  fertNum: { fontFamily: fonts.black, fontSize: 34, color: colors.textPrimary, includeFontPadding: false, letterSpacing: -0.5 },
  fertUnit: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  // 右カード
  bonusBody: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: spacing.md },
  bonusValue: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 38, borderRadius: radius.pill },
  claimText: { fontFamily: fonts.black, fontSize: 13.5, color: colors.white },
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
});
