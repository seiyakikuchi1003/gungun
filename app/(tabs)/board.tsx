import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { ExpandableFab } from '@/components/ui/ExpandableFab';
import { PostCard } from '@/components/board/PostCard';
import { boardPosts, boardTagFilters, trendingTags } from '@/data/mockSocial';

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>('all');
  const list = boardPosts.filter((p) => filter === 'all' || p.tag === filter);

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
        <PressableScale activeScale={0.9} style={styles.searchBtn}>
          <Ionicons name="search" size={20} color={colors.textPrimary} />
        </PressableScale>
      </View>

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
            {trendingTags.map((t) => (
              <PressableScale key={t} activeScale={0.95} style={styles.trendChip}>
                <Text style={styles.trendChipText}>{t}</Text>
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        {list.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(80 + i * 60).duration(400)}>
            <PostCard post={p} onPress={() => router.push(`/board/${p.id}`)} />
          </Animated.View>
        ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: spacing.md },
  title: { fontFamily: fonts.black, fontSize: 26, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  searchBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  filtersRow: { height: 60 },
  filters: { paddingHorizontal: 20, gap: spacing.sm, alignItems: 'center', paddingVertical: 10 },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: radius.pill, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.green },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  feed: { paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: 170, gap: spacing.lg },
  trend: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  trendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  trendTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trendChip: { backgroundColor: colors.greenSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  trendChipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.green },
});
