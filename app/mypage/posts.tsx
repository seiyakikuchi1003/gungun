import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TopTabs } from '@/components/ui/TopTabs';
import { PostRow } from '@/components/ui/PostRow';
import { useBoard } from '@/hooks/useBoard';
import { useMe } from '@/store/me';
import { isSupabaseEnabled } from '@/lib/supabase';

const myComments = [
  { id: 'mc1', on: 'さくらさんの投稿', body: 'おめでとうございます！自分も頑張ります🌱', time: '8分前' },
  { id: 'mc2', on: 'はるさんの投稿', body: 'スムーズな取引でしたね！', time: '昨日' },
];

export default function MyPosts() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('posts');
  const me = useMe();
  const { posts } = useBoard();
  // 実DB接続時は自分の投稿だけ。モックでは従来のデモ用の絞り込みを維持
  const mine = isSupabaseEnabled
    ? posts.filter((p) => p.userId === me.id)
    : posts.filter((p) => p.userId === 'metan' || p.id === 'p1');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>掲示板投稿履歴</Text>
        <View style={styles.hBtn} />
      </View>
      <TopTabs tabs={[{ key: 'posts', label: '投稿' }, { key: 'comments', label: 'コメント' }]} active={tab} onChange={setTab} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {tab === 'posts'
          ? mine.map((p) => <PostRow key={p.id} post={p} onPress={() => router.push(`/board/${p.id}`)} />)
          : myComments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.on}>{c.on} へのコメント・{c.time}</Text>
                <Text style={styles.body}>{c.body}</Text>
              </View>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  comment: { paddingHorizontal: 20, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  on: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  body: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary, marginTop: 4 },
});
