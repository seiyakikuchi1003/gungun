import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { PressableScale } from './PressableScale';
import { Avatar } from './Avatar';
import { BoardPost } from '@/data/mockSocial';
import { getUser } from '@/data/mock';

/** 掲示板の投稿行（Twitter風）。一覧・履歴で共用。 */
export function PostRow({ post, onPress }: { post: BoardPost; onPress?: () => void }) {
  const u = getUser(post.userId);
  const [liked, setLiked] = useState(!!post.liked);
  return (
    <PressableScale onPress={onPress} activeScale={0.99} style={styles.post}>
      <Avatar uri={u.avatar} name={u.nickname} size={44} />
      <View style={{ flex: 1 }}>
        <View style={styles.postHead}>
          <Text style={styles.name}>{u.nickname}</Text>
          <Text style={styles.time}>・{post.createdAt}</Text>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textPlaceholder} style={{ marginLeft: 'auto' }} />
        </View>
        <Text style={styles.body}>{post.body}</Text>
        <View style={styles.actions}>
          <View style={styles.action}>
            <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
            <Text style={styles.actionText}>{post.commentCount}</Text>
          </View>
          <PressableScale onPress={() => setLiked((l) => !l)} activeScale={0.85} style={styles.action}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? colors.heart : colors.textSecondary} />
            <Text style={[styles.actionText, liked && { color: colors.heart }]}>{post.likeCount + (liked ? 1 : 0)}</Text>
          </PressableScale>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  post: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: 20, paddingVertical: spacing.lg, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  time: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  body: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
});
