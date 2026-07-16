import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { boardPosts, boardComments } from '@/data/mockSocial';
import { getUser } from '@/data/mock';

export default function BoardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const post = boardPosts.find((p) => p.id === id);
  const [text, setText] = useState('');
  const [comments, setComments] = useState(boardComments[id ?? ''] ?? []);

  if (!post) return <View style={styles.root} />;
  const u = getUser(post.userId);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>投稿</Text>
        <PressableScale activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.postWrap}>
          <View style={styles.postHead}>
            <Avatar uri={u.avatar} name={u.nickname} size={46} />
            <View>
              <Text style={styles.name}>{u.nickname}</Text>
              <Text style={styles.time}>{post.createdAt}</Text>
            </View>
          </View>
          <Text style={styles.body}>{post.body}</Text>
          <View style={styles.stats}>
            <Text style={styles.stat}><Text style={styles.statNum}>{post.likeCount}</Text> いいね</Text>
            <Text style={styles.stat}><Text style={styles.statNum}>{comments.length}</Text> コメント</Text>
          </View>
        </View>

        <Text style={styles.commentsTitle}>コメント</Text>
        {comments.map((c) => {
          const cu = getUser(c.userId);
          return (
            <View key={c.id} style={styles.comment}>
              <Avatar uri={cu.avatar} name={cu.nickname} size={36} />
              <View style={styles.bubble}>
                <View style={styles.cHead}>
                  <Text style={styles.cName}>{cu.nickname}</Text>
                  <Text style={styles.time}>{c.createdAt}</Text>
                </View>
                <Text style={styles.cBody}>{c.body}</Text>
              </View>
            </View>
          );
        })}
        {comments.length === 0 && <Text style={styles.empty}>最初のコメントを書いてみましょう</Text>}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }, shadows.sheet]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="コメントを入力"
            placeholderTextColor={colors.textPlaceholder}
            style={styles.input}
          />
          <PressableScale
            activeScale={0.9}
            onPress={() => {
              if (!text.trim()) return;
              setComments((c) => [...c, { id: `t${c.length}`, userId: 'metan', body: text.trim(), createdAt: 'たった今' }]);
              setText('');
            }}
            style={styles.send}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  postWrap: { paddingHorizontal: 20, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26, color: colors.textPrimary, marginTop: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  stat: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  statNum: { fontFamily: fonts.bold, color: colors.textPrimary },
  commentsTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  comment: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: 20, paddingVertical: spacing.md },
  bubble: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: spacing.md, ...shadows.soft },
  cHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cName: { fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary },
  cBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textPrimary, marginTop: 3 },
  empty: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 20 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  input: { flex: 1, backgroundColor: colors.cardMuted, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
});
