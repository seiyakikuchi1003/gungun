import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { ExpandableFab } from '@/components/ui/ExpandableFab';
import { PostCard } from '@/components/board/PostCard';
import { Toast } from '@/components/ui/Toast';
import { PostActionSheet } from '@/components/feature/PostActionSheet';
import { ReportSheet } from '@/components/feature/ReportSheet';
import { boardTagFilters, trendingTags } from '@/data/mockSocial';
import { useBoard, type UIPost } from '@/hooks/useBoard';
import { useBlocks } from '@/store/blocks';
import { useMe } from '@/store/me';

export default function BoardScreen() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const { isBlocked } = useBlocks();
  const [filter, setFilter] = useState<string>('all');
  const [hidden, setHidden] = useState<string[]>([]); // 自分で削除した投稿ID
  const [sheetPost, setSheetPost] = useState<UIPost | null>(null);
  const [report, setReport] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const { posts, loading, reload, remove } = useBoard();
  const q = query.trim().replace(/^#/, '').toLowerCase();
  const list = posts.filter(
    (p) =>
      (filter === 'all' || p.tag === filter) &&
      (q === '' || p.body.toLowerCase().includes(q)) &&
      !isBlocked(p.userId) &&
      !hidden.includes(p.id)
  );

  /** 人気のタグをタップ＝そのキーワードで検索する */
  const searchTag = (tag: string) => {
    setQuery(tag);
    setSearchOpen(true);
  };

  // 投稿FABの開閉に使うスクロール位置
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={styles.root}>
      {/* ヘッダー */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.title}>掲示板</Text>
          <Text style={styles.subtitle}>交換の様子や質問をシェアしよう</Text>
        </View>
        <PressableScale
          activeScale={0.9}
          onPress={() => { setSearchOpen((v) => !v); if (searchOpen) setQuery(''); }}
          style={[styles.searchBtn, searchOpen && styles.searchBtnOn]}
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={20} color={searchOpen ? colors.white : colors.textPrimary} />
        </PressableScale>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="投稿を検索"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <PressableScale onPress={() => setQuery('')} activeScale={0.85} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textPlaceholder} />
            </PressableScale>
          )}
        </View>
      )}

      {/* フィルター */}
      <View style={styles.filtersRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {boardTagFilters.map((f) => {
          const on = filter === f.key;
          return (
            <PressableScale key={f.key} activeScale={0.94} onPress={() => setFilter(f.key)} style={[styles.chip, on && styles.chipOn, shadows.soft]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feed}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* トレンド */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.trend, shadows.soft]}>
          <View style={styles.trendHead}>
            <Ionicons name="trending-up" size={16} color={colors.green} />
            <Text style={styles.trendTitle}>人気のタグ</Text>
          </View>
          <View style={styles.trendTags}>
            {trendingTags.map((t) => {
              const on = q !== '' && t.toLowerCase().includes(q);
              return (
                <PressableScale key={t} activeScale={0.95} onPress={() => searchTag(t)} style={[styles.trendChip, on && styles.trendChipOn]}>
                  <Text style={[styles.trendChipText, on && styles.trendChipTextOn]}>{t}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

        {list.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(80 + i * 60).duration(400)}>
            <PostCard post={p} onPress={() => router.push(`/board/${p.id}`)} onMore={() => setSheetPost(p)} onCopied={() => setToast('投稿をコピーしました')} />
          </Animated.View>
        ))}
        {list.length === 0 && (
          <Text style={styles.empty}>
            {loading ? '読み込み中…' : q !== '' ? `「${query}」に一致する投稿はありません` : '表示できる投稿がありません'}
          </Text>
        )}
      </Animated.ScrollView>

      {/* 投稿FAB（ホームと同じ位置・同じ挙動に統一） */}
      <ExpandableFab
        scrollY={scrollY}
        onPress={() => router.push('/board/new')}
        label="投稿する"
        icon={<Ionicons name="create" size={22} color={colors.white} />}
        labelWidth={86}
        bottom={26}
      />

      {/* 投稿の…メニュー（削除 or 通報/ブロック） */}
      {sheetPost && (
        <PostActionSheet
          visible={!!sheetPost}
          onClose={() => setSheetPost(null)}
          authorId={sheetPost.userId}
          isOwner={sheetPost.userId === me.id}
          onReport={() => setReport(true)}
          onDelete={() => { setHidden((h) => [...h, sheetPost.id]); remove(sheetPost.id); }}
        />
      )}
      <ReportSheet visible={report} onClose={() => setReport(false)} targetLabel="この投稿" targetType="board_post" targetId={sheetPost?.id ?? ''} />
      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: spacing.md },
  title: { fontFamily: fonts.black, fontSize: 26, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  searchBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  searchBtnOn: { backgroundColor: colors.green },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 42, marginHorizontal: 20, marginBottom: spacing.sm, ...shadows.soft },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.textPrimary },
  filtersRow: { height: 60 },
  filters: { paddingHorizontal: 20, gap: spacing.sm, alignItems: 'center', paddingVertical: 10 },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: radius.pill, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.green },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  feed: { paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: 170, gap: spacing.lg },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  trend: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  trendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  trendTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trendChip: { backgroundColor: colors.greenSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  trendChipOn: { backgroundColor: colors.green },
  trendChipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.green },
  trendChipTextOn: { color: colors.white },
});
