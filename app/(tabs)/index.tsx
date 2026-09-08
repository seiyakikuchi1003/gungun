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
import { howToSteps, categories } from '@/data/mock';
import { useTree } from '@/store/tree';
import { useBlocks } from '@/store/blocks';
import { useNotifications } from '@/store/notifications';
import { medium, success } from '@/lib/haptics';
import { playSfx, preloadSfx } from '@/lib/sound';
import { useMe } from '@/store/me';
import { useLoginBonus } from '@/hooks/useLoginBonus';
import { useExchanges } from '@/hooks/useExchanges';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { usePremiumOwners } from '@/hooks/usePremiumOwners';
import { lh } from '@/lib/fontScale';

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
          <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{count > 99 ? '99+' : count}</Text>
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

/**
 * 上部バーの高さの目安（検索欄 46 ＋ 下の余白 16）。
 *
 * 端末の文字サイズを大きくすると検索欄も高くなるので、実際の高さは
 * onLayout で測って使う。ここはその測定が終わるまでの初期値。
 * （2026-08-21 指摘：文字を大きくすると検索の枠から出る・改行される）
 */
const TOP_BAR_H = 62;

/** ホームの並び替え */
const SORTS = [
  { key: 'recommend', label: 'おすすめ', note: 'プレミアム会員の出品を優先' },
  { key: 'new', label: '新着順', note: '出品が新しい順' },
  { key: 'water', label: '水やりが多い順', note: '多くの人が交換を希望している順' },
  { key: 'like', label: '人気順', note: 'いいねが多い順' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

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
  const [sort, setSort] = useState<SortKey>('recommend');
  // 「おすすめ」はプレミアム会員の出品を優先する（2026-08-21 指摘）。
  // 以前は「最近見た区分に近い順」だったが、何を基準にしているのか伝わらなかった。
  const premiumOwners = usePremiumOwners();
  // 上部バーの実寸。文字サイズを大きくすると伸びるので、本文の余白もそれに追従させる
  const [topBarH, setTopBarH] = useState(TOP_BAR_H);
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

  // ホームに並べる商品。
  // 以前はタネ（parentId=null）だけを出していたが、水やり＝出品なので
  // 水やりで出した商品も一級の商品として並べる（要件 第3章／2026-08-13 項目1）。
  // 収穫が決まった（取引中・完了）ものは出さない。
  // 出しておくと水やりできそうに見えるが、実際には受け付けられない（2026-08-05 指摘）
  // すでに自分が関わっている木（自分のタネ・水やり済み）は水やりできない。
  // 出しておくと押せそうに見えるので、ホームからは外す（2026-08-13 指摘）
  const myRoots = new Set(items.filter((i) => i.ownerId === me.id).map((i) => i.rootId));
  const seedsBase = items
    .filter((i) => i.status === 'growing' && !isBlocked(i.ownerId) && !myRoots.has(i.rootId))
    .reverse();
  const shift = refreshTick % Math.max(seedsBase.length, 1);
  const seeds = seedsBase.slice(shift).concat(seedsBase.slice(0, shift));
  // 出品したカテゴリーのまま並べる。
  // 以前は「ファッション・小物」などの独自のくくりに寄せていたため、
  // 「メンズで出したのにファッション・小物に入る」と食い違って見えた（2026-08-13 指摘）。
  // 出品時に選べる区分（categories）とホームの見出しを一致させる。
  const SUBTITLE: Record<string, string> = {
    '本・漫画・CD・DVD': '読みもの・音楽・映像',
    'ファッション・アクセサリー': '服・バッグ・小物',
    '趣味・サブカル': 'ゲーム・ホビー・コレクション',
    'コスメ・美容': 'メイク・スキンケア',
    'ベビー・キッズ用品': 'こども服・おもちゃ・育児用品',
    '家電・デジタルガジェット': 'スマホ・PC・生活家電',
    '日用品・雑貨・文具': 'キッチン・インテリア・文房具',
    '食品（常温のみ）': '常温で送れるもの',
    'スポーツ用品': '道具・ウェア・トレーニング',
    'アウトドア・旅行品': 'キャンプ・登山・旅の道具',
  };
  /**
   * 並び替え（2026-08-21 指摘）。
   *
   * 「おすすめ」はカテゴリー別に並べたうえで、
   * 各カテゴリーの中で**プレミアム会員の出品を先に**出す。
   * 以前は「最近見た区分に近い順」だったが、何を基準にしているのか
   * 伝わらないという指摘があったため、説明できる基準に変えた。
   * それ以外を選んだときは、カテゴリーの区切りをやめて1本の並びで見せる。
   * 「水やりが多い順」と「新着順」は区切ったままだと比べにくいため。
   */
  const premiumFirst = (list: typeof seeds) =>
    [...list].sort((a, b) => {
      const pa = premiumOwners.has(a.ownerId) ? 1 : 0;
      const pb = premiumOwners.has(b.ownerId) ? 1 : 0;
      return pb - pa; // それ以外の並びは元のまま保つ（sort は安定）
    });
  /**
   * カテゴリー分け。
   *
   * 一覧に無いカテゴリーの商品は、どのグループにも入らずホームから消えていた。
   * Click の区分に合わせたことで旧カテゴリーの商品が出るうえ、
   * 表記ゆれ（例：コスメ／コスメ・美容）も起こりうる。
   *
   * Click には「その他」が無いので、出品時に選べる区分としては持たない。
   * ただし取りこぼした商品が黙って消えるのは困るので、
   * **表示のときだけ**末尾に受け皿のグループを足す（該当が無ければ出ない）。
   */
  const known = new Set(categories);
  const OTHER_GROUP = 'その他';
  const leftovers = seeds.filter((s) => !known.has(s.category));
  const visibleGroups =
    sort === 'recommend'
      ? [
          ...categories.map((c) => ({
            title: c,
            subtitle: SUBTITLE[c] ?? '',
            items: premiumFirst(seeds.filter((s) => s.category === c)),
          })),
          {
            title: OTHER_GROUP,
            subtitle: 'どれにも当てはまらないもの',
            items: premiumFirst(leftovers),
          },
        ]
          .filter((g) => g.items.length > 0)
          // 出品の多いカテゴリーから見せる。受け皿は必ず最後に回す
          .sort((a, b) => {
            if (a.title === OTHER_GROUP) return 1;
            if (b.title === OTHER_GROUP) return -1;
            return b.items.length - a.items.length;
          })
      : [
          {
            title: SORTS.find((x) => x.key === sort)?.label ?? '',
            subtitle: SORTS.find((x) => x.key === sort)?.note ?? '',
            items: [...seeds].sort((a, b) => {
              if (sort === 'water') return b.waterCount - a.waterCount;
              if (sort === 'like') return b.likeCount - a.likeCount;
              // 新着順。createdAt が無いモックでは並びを変えない
              const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
              const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
              return tb - ta;
            }),
          },
        ].filter((g) => g.items.length > 0);

  return (
    <View style={styles.root}>
      <View style={styles.leafBg} pointerEvents="none">
        <LeafDecor width={220} height={300} flip opacity={0.35} />
      </View>

      {/* 検索・通知・マイページは上部に固定する。
          スクロールで流れると、探したいときに毎回いちばん上まで戻る必要があった（2026-08-12 指摘） */}
      <View
        style={[styles.topBarFixed, { paddingTop: insets.top + 8 }]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height - (insets.top + 8);
          if (h > 0 && Math.abs(h - topBarH) > 1) setTopBarH(h);
        }}
      >
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.push('/search')} activeScale={0.98} style={[styles.search, shadows.soft]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <Text style={styles.searchPlaceholder} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              欲しいものを探してみよう
            </Text>
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
        contentContainerStyle={{ paddingTop: insets.top + 8 + topBarH, paddingBottom: 170 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={[colors.green]}
            progressViewOffset={insets.top + 8 + topBarH}
          />
        }
      >
        {/* 肥料残高／ログインボーナス（白いカード2枚を横並び） */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.section, styles.cardsRow]}>
          {/* 左：現在の肥料。押したらチャージへ（2026-08-14 指摘：見えるだけで押せなかった） */}
          <PressableScale
            activeScale={0.97}
            onPress={() => router.push('/fertilizer')}
            style={[styles.infoCard, shadows.card]}
          >
            <View pointerEvents="none" style={styles.cardLeaf}>
              <LeafDecor width={74} height={88} opacity={0.35} />
            </View>
            <View style={styles.infoLabelRow}>
              <Text style={styles.infoLabel}>現在の肥料</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />
            </View>
            <View style={styles.fertBody}>
              <Sprout size={44} base />
              <View style={styles.fertNumRow}>
                {/* 34px の数字がそのまま倍になるとカードから溢れる。
                    数字は読めれば足りるので、伸びしろに上限をつける（2026-08-21） */}
                <Text style={styles.fertNum} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                  {fertilizer.toLocaleString()}
                </Text>
                <Text style={styles.fertUnit} maxFontSizeMultiplier={1.4}>肥料</Text>
              </View>
            </View>
            <Text style={styles.fertCharge}>タップでチャージ</Text>
          </PressableScale>

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
                <Text style={styles.claimText} numberOfLines={1} maxFontSizeMultiplier={1.5}>{claimed ? '受取済' : '受け取る'}</Text>
                <Ionicons
                  name={claimed ? 'checkmark' : 'chevron-forward'}
                  size={15}
                  color={colors.white}
                />
              </LinearGradient>
            </PressableScale>
          </View>
        </Animated.View>

        {/* みんなの出品（テーマ別モザイク）。タネも水やりで出した商品も並ぶ */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <Sprout size={20} />
              {/* 文字サイズを大きくすると「すべて見る」と重なっていた（2026-08-21）。
                  見出し側を縮められるようにして、収まらなければ省略する */}
              <Text style={styles.sectionTitle} numberOfLines={1}>みんなの出品</Text>
            </View>
            <PressableScale onPress={() => router.push('/search')} style={styles.seeAllBtn}>
              <Text style={styles.seeAll} numberOfLines={1}>すべて見る ›</Text>
            </PressableScale>
          </View>

          {/* 並び替え。押した順番で見え方が変わるので、選んでいるものを塗って示す */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortRow}
          >
            {SORTS.map((o) => (
              <PressableScale
                key={o.key}
                activeScale={0.95}
                onPress={() => setSort(o.key)}
                style={[styles.sortChip, sort === o.key && styles.sortChipOn]}
              >
                <Text style={[styles.sortText, sort === o.key && styles.sortTextOn]}>{o.label}</Text>
              </PressableScale>
            ))}
          </ScrollView>
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
  sortRow: { gap: spacing.sm, paddingHorizontal: 20, paddingBottom: spacing.md },
  sortChip: {
    paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  sortChipOn: { backgroundColor: colors.green, borderColor: colors.green },
  sortText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  sortTextOn: { fontFamily: fonts.bold, color: colors.white },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fertCharge: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.green, marginTop: 4 },
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
    // height 固定だと、端末の文字サイズを大きくしたときに枠から文字がはみ出す。
    // 伸びられるようにして、枠のほうを文字に合わせる（2026-08-21 指摘）
    minHeight: 46,
    paddingVertical: 6,
    paddingHorizontal: spacing.lg,
  },
  // flexShrink を効かせないと、長い文字が虫めがねアイコンを押し出してしまう
  searchPlaceholder: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPlaceholder },
  badge: {
    position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, borderRadius: 8.5,
    backgroundColor: '#E4796F', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.bg,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white, lineHeight: lh(13) },
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
  fertNumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  fertNum: { flexShrink: 1, fontFamily: fonts.black, fontSize: 34, color: colors.textPrimary, includeFontPadding: false, letterSpacing: -0.5 },
  fertUnit: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  // 右カード
  bonusBody: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: spacing.md },
  bonusValue: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: lh(18), color: colors.textPrimary },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 38, borderRadius: radius.pill, paddingVertical: 6 },
  claimText: { flexShrink: 1, fontFamily: fonts.black, fontSize: 13.5, color: colors.white },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: spacing.md },
  sectionTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  sectionTitle: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary },
  seeAllBtn: { flexShrink: 0, marginLeft: spacing.sm },
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
  stepDesc: { fontFamily: fonts.regular, fontSize: 11, lineHeight: lh(16), color: colors.textSecondary, textAlign: 'center' },
});
