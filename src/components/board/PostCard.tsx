import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { HeartButton } from '@/components/ui/HeartButton';
import { TAG_META } from '@/data/mockSocial';
import type { UIPost } from '@/hooks/useBoard';
import { shareText } from '@/lib/share';

/** モダンなカード型の投稿。掲示板フィードの主役。 */
export function PostCard({ post, onPress, onMore, onCopied }: { post: UIPost; onPress?: () => void; onMore?: () => void; onCopied?: () => void }) {
  // 著者名・アバターは投稿の行が持っている（実DBでは UUID から引けないため）
  const u = { nickname: post.authorName, avatar: post.authorAvatar };
  const tag = TAG_META[post.tag];

  /** 投稿の本文を共有。Web でコピーになったときは呼び出し側に知らせる */
  const share = async () => {
    const res = await shareText(`${u.nickname}さんの投稿（ぐんぐん）\n\n${post.body}`);
    if (res === 'copied') onCopied?.();
  };

  return (
    <PressableScale onPress={onPress} activeScale={0.985} style={[styles.card, shadows.card]}>
      {post.pinned && (
        <View style={styles.pinned}>
          <Ionicons name="megaphone" size={12} color={colors.orangeDeep} />
          <Text style={styles.pinnedText}>注目の投稿</Text>
        </View>
      )}
      <View style={styles.head}>
        <Avatar uri={u.avatar} name={u.nickname} size={42} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{u.nickname}</Text>
            <View style={[styles.tag, { backgroundColor: tag.bg }]}>
              <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
            </View>
          </View>
          <Text style={styles.time}>{post.createdAt}</Text>
        </View>
        <PressableScale activeScale={0.85} style={styles.more} onPress={onMore} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textPlaceholder} />
        </PressableScale>
      </View>

      <Text style={styles.body}>{post.body}</Text>

      {(post.image != null || post.imageUrl) && (
        <Image
          source={post.image ?? { uri: post.imageUrl! }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      )}

      <View style={styles.actions}>
        <HeartButton count={post.likeCount} initial={post.liked} id={`post:${post.id}`} />
        <View style={styles.action}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </View>
        <PressableScale activeScale={0.85} onPress={share} hitSlop={8} style={[styles.action, { marginLeft: 'auto' }]}>
          <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
        </PressableScale>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.orangeSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginBottom: -2 },
  pinnedText: { fontFamily: fonts.bold, fontSize: 11, color: colors.orangeDeep },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  tag: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.bold, fontSize: 10.5 },
  time: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  more: { padding: 4 },
  body: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 23, color: colors.textPrimary },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.md, backgroundColor: colors.cardMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
