import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { PressableScale } from './PressableScale';
import { Avatar } from './Avatar';
import { HeartButton } from './HeartButton';
import { BoardPost } from '@/data/mockSocial';
import { useUsers } from '@/store/users';
import { lh } from '@/lib/fontScale';

/**
 * 掲示板の投稿行（Twitter風）。一覧・履歴で共用。
 *
 * 名前とアイコンは、行が持っていればそれを使い（実DBのビューが持っている）、
 * 無ければ users ストアで id から引く。以前はモックの getUser だけを見ていたため、
 * 実データでは全部「名無し」になっていた。
 *
 * いいねは HeartButton（likes ストア）に寄せた。以前はこの行だけ useState で
 * 持っていたので、押しても DB に入らず画面を離れると消えていた。
 */
export function PostRow({
  post,
  onPress,
}: {
  // authorAvatar はモック経路だと require の数値になりうる（Avatar が両対応）
  post: BoardPost & { authorName?: string; authorAvatar?: string | number };
  onPress?: () => void;
}) {
  const users = useUsers();
  const fallback = users.user(post.userId);
  const name = post.authorName?.trim() || fallback.nickname;
  const avatar = post.authorAvatar || fallback.avatar;

  return (
    <PressableScale onPress={onPress} activeScale={0.99} style={styles.post}>
      <Avatar uri={avatar} name={name} size={44} />
      <View style={{ flex: 1 }}>
        <View style={styles.postHead}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>・{post.createdAt}</Text>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textPlaceholder} style={{ marginLeft: 'auto' }} />
        </View>
        <Text style={styles.body}>{post.body}</Text>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
            <Text style={styles.actionText}>{post.commentCount}</Text>
          </View>
          <HeartButton count={post.likeCount} initial={!!post.liked} size={17} id={`post:${post.id}`} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  post: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: 20, paddingVertical: spacing.lg, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, flexShrink: 1 },
  time: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  body: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: lh(22), color: colors.textPrimary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.md, alignItems: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
});
