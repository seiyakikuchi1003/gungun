import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { HeartButton } from '@/components/ui/HeartButton';
import { ReportSheet } from '@/components/feature/ReportSheet';
import { TAG_META } from '@/data/mockSocial';
import { useBoardPost } from '@/hooks/useBoard';
import { useMe } from '@/store/me';

export default function BoardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const { post, comments, addComment, removeComment } = useBoardPost(id ?? '');
  const [text, setText] = useState('');
  const [report, setReport] = useState(false);

  if (!post) return <View style={styles.root} />;
  const u = { nickname: post.authorName, avatar: post.authorAvatar };
  const tag = TAG_META[post.tag];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>投稿</Text>
        <PressableScale onPress={() => setReport(true)} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ReportSheet visible={report} onClose={() => setReport(false)} targetLabel="この投稿" targetType="board_post" targetId={post.id} />

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 投稿カード */}
        <View style={[styles.postCard, shadows.card]}>
          <View style={styles.postHead}>
            <Avatar uri={u.avatar} name={u.nickname} size={48} />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{u.nickname}</Text>
                <View style={[styles.tag, { backgroundColor: tag.bg }]}>
                  <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
                </View>
              </View>
              <Text style={styles.time}>{post.createdAt}</Text>
            </View>
          </View>
          <Text style={styles.body}>{post.body}</Text>
          {post.image != null && <Image source={post.image} style={styles.image} contentFit="cover" transition={200} />}
          <View style={styles.stats}>
            <HeartButton count={post.likeCount} initial={post.liked} size={20} id={`post:${post.id}`} />
            <View style={styles.stat}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.statText}>{comments.length}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.commentsTitle}>コメント {comments.length}</Text>
        {comments.map((c) => {
          const cu = { nickname: c.authorName, avatar: c.authorAvatar };
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
          {/* 空のときは押せないことが見て分かるように薄くする */}
          <PressableScale
            activeScale={0.9}
            disabled={!text.trim()}
            onPress={() => {
              addComment(text);
              setText('');
            }}
            style={[styles.send, !text.trim() && { opacity: 0.4 }]}
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
  postCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, margin: 20, gap: spacing.md },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary },
  tag: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.bold, fontSize: 10.5 },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 25, color: colors.textPrimary },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.md, backgroundColor: colors.cardMuted },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  commentsTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, paddingHorizontal: 20, paddingBottom: spacing.sm },
  comment: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: 20, paddingVertical: spacing.sm },
  bubble: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: spacing.md, ...shadows.soft },
  cHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cName: { fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary },
  cBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textPrimary, marginTop: 3 },
  empty: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 20 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  input: { flex: 1, minWidth: 0, backgroundColor: colors.cardMuted, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
});
