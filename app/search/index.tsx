import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { RefreshSpinner } from '@/components/ui/RefreshSpinner';
import { ItemCard } from '@/components/ui/ItemCard';
import { categories, conditions } from '@/data/mock';
import { useTree } from '@/store/tree';
import { useBlocks } from '@/store/blocks';
import { medium } from '@/lib/haptics';
import { playSfx } from '@/lib/sound';
import { loadSearchHistory, pushSearchHistory, removeSearchHistory } from '@/lib/searchHistory';
import { logSearch } from '@/lib/api/search';
import { usePopularKeywords } from '@/hooks/usePopularKeywords';

const RECENT = ['Nintendo Switch', 'iPhone', 'バッグ', 'カメラ'];
/**
 * 「人気のキーワード」の初期値。
 * 実際の検索ログが貯まるまでのあいだだけ使う（2026-08-21 指摘）。
 * ギフト券はカテゴリーごと廃止したので外した。
 */
const TRENDING_FALLBACK = ['ゲーム機', 'ワイヤレスイヤホン', 'ブランド財布', 'スニーカー', '本まとめ売り', 'アウター'];
type Sort = 'new' | 'water';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items } = useTree();
  const { isBlocked } = useBlocks();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  // 商品の状態（コンディション）で絞る。このアプリに価格は無いので、
  // メルカリの「価格帯」に相当する軸として状態を使う
  const [cond, setCond] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const cardW = (width - 20 * 2 - 12) / 2;

  const results = useMemo(() => {
    let r = items.filter((i) => i.status === 'growing' && !isBlocked(i.ownerId));
    if (q) r = r.filter((i) => (i.name + i.description).toLowerCase().includes(q.toLowerCase()));
    if (cat) r = r.filter((i) => i.category === cat);
    if (cond) r = r.filter((i) => i.condition === cond);
    r = [...r].sort((a, b) => (sort === 'water' ? b.waterCount - a.waterCount : 0));
    return r;
  }, [q, cat, cond, sort, items, isBlocked]);

  const searching = q.length > 0 || cat !== null || cond !== null;

  // 検索履歴（端末保存）。確定したときだけ積む
  useEffect(() => { loadSearchHistory().then(setHistory); }, []);
  const commitSearch = useCallback((word: string) => {
    setQ(word);
    pushSearchHistory(word).then(setHistory);
    // 何が検索されているかを貯めて「人気のキーワード」に反映する（2026-08-21 指摘）
    logSearch(word, 'item');
  }, []);

  // 実際によく検索されている語。まだ貯まっていなければ既定の並び
  const trending = usePopularKeywords(TRENDING_FALLBACK, 'item');

  // 注目の種：引っ張って更新で並びが入れ替わる（X/インスタ風）
  const hot = useMemo(
    () => [...items].filter((i) => i.status === 'growing' && !isBlocked(i.ownerId)).sort((a, b) => b.waterCount - a.waterCount),
    [items, isBlocked]
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const shift = (refreshTick * 3) % Math.max(hot.length, 1);
  const hotList = hot.slice(shift).concat(hot.slice(0, shift)).slice(0, 8);

  const scrollY = useSharedValue(0); // 引っ張り量 → カスタムスピナーの回転に連動
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    medium();
    setTimeout(() => {
      setRefreshTick((t) => t + 1);
      setRefreshing(false);
      playSfx('pop');
    }, 1300);
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <View style={[styles.searchBar, shadows.soft]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="欲しいものを探してみよう"
            placeholderTextColor={colors.textPlaceholder}
            style={[styles.input, { outlineStyle: 'none' } as object]}
            maxFontSizeMultiplier={1.4}
            returnKeyType="search"
            onSubmitEditing={(e) => commitSearch(e.nativeEvent.text)}
          />
          {q ? (
            <PressableScale onPress={() => setQ('')} activeScale={0.85}>
              <Ionicons name="close-circle" size={18} color={colors.textPlaceholder} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {/* カテゴリーチップ */}
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsRow}>
        <Chip label="すべて" on={cat === null} onPress={() => setCat(null)} />
        {categories.map((c) => (
          <Chip key={c} label={c} on={cat === c} onPress={() => setCat(cat === c ? null : c)} />
        ))}
      </ScrollView>

      {/* 状態（コンディション）で絞る */}
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsRow}
      >
        <Chip label="状態を問わない" on={cond === null} onPress={() => setCond(null)} />
        {conditions.map((c) => (
          <Chip key={c} label={c} on={cond === c} onPress={() => setCond(cond === c ? null : c)} />
        ))}
      </ScrollView>

      {!searching ? (
        <View style={{ flex: 1 }}>
          <Animated.ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={[colors.green]} />
            }
          >
            <Text style={styles.sectionTitle}>最近の検索</Text>
            <View style={styles.recentWrap}>
              {RECENT.map((r) => (
                <PressableScale key={r} onPress={() => setQ(r)} activeScale={0.96} style={styles.recentChip}>
                  <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.recentText}>{r}</Text>
                </PressableScale>
              ))}
            </View>

            {/* 検索履歴（端末保存。個人の行動記録なのでサーバーには送らない）*/}
            {history.length ? (
              <>
                <View style={styles.resultHead}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>最近の検索</Text>
                </View>
                <View style={styles.recentWrap}>
                  {history.map((h) => (
                    <PressableScale
                      key={h}
                      onPress={() => commitSearch(h)}
                      activeScale={0.96}
                      style={styles.histChip}
                    >
                      <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.histText}>{h}</Text>
                      <PressableScale
                        onPress={() => removeSearchHistory(h).then(setHistory)}
                        activeScale={0.85}
                        hitSlop={6}
                      >
                        <Ionicons name="close" size={13} color={colors.textPlaceholder} />
                      </PressableScale>
                    </PressableScale>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>人気のキーワード</Text>
            <View style={styles.recentWrap}>
              {trending.map((r, i) => (
                <PressableScale key={r} onPress={() => commitSearch(r)} activeScale={0.96} style={styles.trendChip}>
                  <Text style={styles.trendRank}>{i + 1}</Text>
                  <Text style={styles.trendText}>{r}</Text>
                </PressableScale>
              ))}
            </View>

            <View style={[styles.resultHead, { marginTop: 28 }]}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>注目の種</Text>
              <Text style={styles.hotNote}>水やりが多い順</Text>
            </View>
            {/* 更新のたびに key が変わり、新しい並びがふわっと入れ替わる */}
            <Animated.View key={refreshTick} entering={FadeIn.duration(420)} style={styles.grid}>
              {hotList.map((i, idx) => (
                <ItemCard key={`${i.id}-${idx}`} item={i} width={cardW} onPress={() => router.push(`/item/${i.id}`)} />
              ))}
            </Animated.View>
          </Animated.ScrollView>

          {/* X風のカスタム更新スピナー（引っ張りに連動して回転） */}
          <RefreshSpinner pullY={scrollY} refreshing={refreshing} topOffset={4} />
        </View>
      ) : (
        <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.resultHead}>
            <Text style={styles.resultCount}>{results.length}件</Text>
            <View style={styles.sortRow}>
              <SortBtn label="新着順" on={sort === 'new'} onPress={() => setSort('new')} />
              <SortBtn label="水やり数順" on={sort === 'water'} onPress={() => setSort('water')} />
            </View>
          </View>
          <View style={styles.grid}>
            {results.map((i) => (
              <ItemCard key={i.id} item={i} width={cardW} onPress={() => router.push(`/item/${i.id}`)} />
            ))}
          </View>
          {results.length === 0 && <Text style={styles.empty}>該当する商品がありません</Text>}
        </ScrollView>
      )}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.95} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </PressableScale>
  );
}
function SortBtn({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.95}>
      <Text style={[styles.sortText, on && styles.sortOn]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 12, paddingBottom: spacing.md },
  back: { width: 36, height: 44, justifyContent: 'center', alignItems: 'center' },
  // height 固定だと端末の文字サイズを大きくしたときに枠から文字がはみ出す（2026-08-21 指摘）
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.pill, minHeight: 46, paddingVertical: 6, paddingHorizontal: spacing.lg },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  chipsRow: { flexGrow: 0 },
  chips: { paddingHorizontal: 20, gap: spacing.sm, paddingVertical: 12, alignItems: 'center' },
  chip: { paddingHorizontal: 16, minHeight: 34, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.card, justifyContent: 'center', ...shadows.soft },
  chipOn: { backgroundColor: colors.green },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  chipTextOn: { color: colors.white, fontFamily: fonts.bold },
  body: { padding: 20, paddingBottom: 60 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md },
  recentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, ...shadows.soft },
  recentText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary },
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.greenSoft, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.greenSoftBorder },
  trendRank: { fontFamily: fonts.black, fontSize: 12, color: colors.green },
  trendText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary },
  hotNote: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  resultCount: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  sortRow: { flexDirection: 'row', gap: spacing.lg },
  histChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.cardMuted,
  },
  histText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary },
  sortText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  sortOn: { color: colors.green, fontFamily: fonts.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
