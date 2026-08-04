import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TopTabs } from '@/components/ui/TopTabs';
import { ItemCard } from '@/components/ui/ItemCard';
import { PostRow } from '@/components/ui/PostRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMe } from '@/store/me';
import { useLikes } from '@/store/likes';
import { isSupabaseEnabled } from '@/lib/supabase';
import { fetchLikedItems, fetchLikedPostIds } from '@/lib/api/social';
import { fetchPostsByIds, type BoardPost } from '@/lib/api/board';
import type { MockItem } from '@/data/mock';

/**
 * いいね一覧（マイページ →「いいね」）。
 *
 * 押したいいねをあとから見返せる導線が無かったため追加。
 * 商品と掲示板の投稿でタブを分ける（押した順＝新しい順）。
 */
export default function Likes() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const likes = useLikes();
  const [tab, setTab] = useState('items');
  const [items, setItems] = useState<MockItem[]>([]);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // ItemCard は幅を受け取る作りなので、画面幅から2列ぶんを計算して渡す
  const { width: winW } = useWindowDimensions();
  const cardW = Math.floor((winW - 14 * 2 - 12) / 2);

  const load = useCallback(async () => {
    if (!isSupabaseEnabled || !me.live) { setLoading(false); return; }
    try {
      const [likedItems, likedPostIds] = await Promise.all([
        fetchLikedItems(me.id),
        fetchLikedPostIds(me.id),
      ]);
      setItems(likedItems);
      setPosts(await fetchPostsByIds(likedPostIds, me.id));
    } catch {
      // 取れなかったときは空のまま。下に引いて再試行できる
    } finally {
      setLoading(false);
    }
  }, [me.id, me.live]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    // ♡の状態も取り直す（別画面で外したものを反映させる）
    await Promise.all([load(), likes.refresh()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>いいね一覧</Text>
        <View style={styles.hBtn} />
      </View>

      <TopTabs
        tabs={[
          { key: 'items', label: `商品${items.length ? ` ${items.length}` : ''}` },
          { key: 'posts', label: `投稿${posts.length ? ` ${posts.length}` : ''}` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
      ) : (
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={tab === 'items' ? styles.grid : { paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        >
          {tab === 'items' ? (
            items.length ? (
              items.map((it) => (
                <View key={it.id} style={styles.cell}>
                  <ItemCard item={it} width={cardW} onPress={() => router.push(`/item/${it.id}`)} />
                </View>
              ))
            ) : (
              <EmptyState
                icon="heart-outline"
                title="いいねした商品はまだありません"
                note="気になる商品の♡を押すと、ここにたまっていきます。"
              />
            )
          ) : posts.length ? (
            posts.map((p) => (
              <PostRow key={p.id} post={p as never} onPress={() => router.push(`/board/${p.id}`)} />
            ))
          ) : (
            <EmptyState
              icon="heart-outline"
              title="いいねした投稿はまだありません"
              note="掲示板で気になる投稿の♡を押すと、ここに残ります。"
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  center: { paddingTop: 60, alignItems: 'center' },
  // 2列。cell 側で幅を持たせる（親に alignItems:'center' を置くと子が内容幅に縮む）
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingTop: spacing.md, paddingBottom: 40 },
  cell: { paddingHorizontal: 6, marginBottom: spacing.md },
});
