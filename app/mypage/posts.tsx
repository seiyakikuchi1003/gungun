import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TopTabs } from '@/components/ui/TopTabs';
import { PostRow } from '@/components/ui/PostRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBoard } from '@/hooks/useBoard';
import { useMe } from '@/store/me';
import { isSupabaseEnabled } from '@/lib/supabase';
import { fetchMyComments, type MyComment } from '@/lib/api/board';

/**
 * 掲示板の履歴。
 *
 * 「投稿」は掲示板と同じ行（PostRow）で見せる。
 * 「コメント」は以前ダミー2件を出しっぱなしにしていたので実データに置き換えた。
 * コメント行は「どの投稿へのコメントか」を引用として見せ、押すとその投稿へ飛ぶ。
 */
export default function MyPosts() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('posts');
  const me = useMe();
  const { posts } = useBoard();
  const [comments, setComments] = useState<MyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 実DB接続時は自分の投稿だけ。モックでは従来のデモ用の絞り込みを維持
  const mine = isSupabaseEnabled
    ? posts.filter((p) => p.userId === me.id)
    : posts.filter((p) => p.userId === 'metan' || p.id === 'p1');

  const load = useCallback(async () => {
    if (!isSupabaseEnabled || !me.live) { setLoading(false); return; }
    try {
      setComments(await fetchMyComments(me.id));
    } catch {
      // 取れなくても投稿タブは見られる
    } finally {
      setLoading(false);
    }
  }, [me.id, me.live]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.dismissTo('/mypage')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>掲示板の履歴</Text>
        <View style={styles.hBtn} />
      </View>

      <TopTabs
        tabs={[
          { key: 'posts', label: `投稿${mine.length ? ` ${mine.length}` : ''}` },
          { key: 'comments', label: `コメント${comments.length ? ` ${comments.length}` : ''}` },
        ]}
        active={tab}
        onChange={setTab}
      />

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        {tab === 'posts' ? (
          mine.length ? (
            mine.map((p) => <PostRow key={p.id} post={p as never} onPress={() => router.push(`/board/${p.id}`)} />)
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="まだ投稿がありません"
              note="交換の報告や質問を書くと、ここに残ります。"
              actionLabel="掲示板に投稿する"
              onAction={() => router.push('/board/new')}
            />
          )
        ) : loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.green} /></View>
        ) : comments.length ? (
          comments.map((c) => (
            <PressableScale
              key={c.id}
              activeScale={0.99}
              onPress={() => router.push(`/board/${c.postId}`)}
              style={[styles.comment, shadows.soft]}
            >
              {/* コメントした先の投稿を引用として見せる */}
              <View style={styles.quote}>
                <Text style={styles.quoteAuthor} numberOfLines={1}>{c.postAuthor} さんの投稿</Text>
                <Text style={styles.quoteBody} numberOfLines={2}>{c.postBody}</Text>
              </View>
              <View style={styles.myRow}>
                <Ionicons name="return-down-forward" size={16} color={colors.green} />
                <Text style={styles.myBody}>{c.body}</Text>
              </View>
              <Text style={styles.time}>{c.createdAt}</Text>
            </PressableScale>
          ))
        ) : (
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="まだコメントがありません"
            note="他の人の投稿にコメントすると、ここに残ります。"
            actionLabel="掲示板を見る"
            onAction={() => router.push('/(tabs)/board')}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  center: { paddingTop: 60, alignItems: 'center' },

  comment: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginHorizontal: 16,
    marginTop: spacing.md,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.greenSoftBorder,
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  quoteAuthor: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },
  quoteBody: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 2 },
  myRow: { flexDirection: 'row', gap: 6 },
  myBody: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.textPlaceholder, marginTop: spacing.sm, textAlign: 'right' },
});
