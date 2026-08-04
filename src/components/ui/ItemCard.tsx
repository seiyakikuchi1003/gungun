import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, fonts, shadows } from '@/theme';
import { PressableScale } from './PressableScale';
import { Thumb } from './Thumb';
import { Avatar } from './Avatar';
import { Sprout } from '@/components/art/Sprout';
import { MockItem } from '@/data/mock';
import { useUsers } from '@/store/users';

type Props = {
  item: MockItem;
  onPress?: () => void;
  width?: number;
  compact?: boolean; // 3列グリッド用の小さめ表示
};

/**
 * 商品カード：サムネイル＋商品名＋カテゴリ＋出品者＋🌱水やり数。
 * ホーム「みんなの種」の3列グリッド／検索結果で使用。
 * compact=true で3列用に余白・文字を詰め、カテゴリ行を省略する。
 */
export function ItemCard({ item, onPress, width = 168, compact = false }: Props) {
  const users = useUsers();
  const owner = users.user(item.ownerId);
  return (
    <PressableScale onPress={onPress} activeScale={0.97} style={[styles.card, { width }, shadows.card]}>
      <View style={styles.thumbWrap}>
        <Thumb source={item.local} uri={item.image} style={styles.thumb} markSize={compact ? 28 : 40} />
        <View style={[styles.waterPill, compact && styles.waterPillCompact]}>
          <Sprout size={compact ? 11 : 13} color={colors.white} />
          <Text style={[styles.waterText, compact && styles.waterTextCompact]}>{item.waterCount}</Text>
        </View>
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact]}>{item.name}</Text>
        {!compact && <Text numberOfLines={1} style={styles.category}>{item.category}</Text>}
        <View style={[styles.ownerRow, compact && { marginTop: 3 }]}>
          <Avatar uri={owner.avatar} name={owner.nickname} size={compact ? 15 : 18} />
          {!compact && <Text numberOfLines={1} style={styles.owner}>{owner.nickname}さん</Text>}
          <Ionicons name="heart" size={compact ? 11 : 12} color={colors.heart} style={{ marginLeft: 'auto' }} />
          <Text style={[styles.like, compact && styles.likeCompact]}>{item.likeCount}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden' },
  thumbWrap: { position: 'relative' },
  thumb: { width: '100%', aspectRatio: 1, backgroundColor: colors.cardMuted },
  waterPill: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(46,158,91,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  waterPillCompact: { left: 5, bottom: 5, paddingHorizontal: 6, paddingVertical: 2, gap: 2 },
  waterText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  waterTextCompact: { fontSize: 10 },
  body: { padding: spacing.md, gap: 3 },
  bodyCompact: { padding: 7, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  nameCompact: { fontSize: 12, lineHeight: 16 },
  category: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.cardMuted },
  owner: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, flexShrink: 1 },
  like: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  likeCompact: { fontSize: 10 },
});
