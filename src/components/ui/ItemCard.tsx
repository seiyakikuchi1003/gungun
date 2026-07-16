import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, fonts, shadows } from '@/theme';
import { PressableScale } from './PressableScale';
import { Thumb } from './Thumb';
import { Avatar } from './Avatar';
import { Sprout } from '@/components/art/Sprout';
import { MockItem, getUser } from '@/data/mock';

type Props = {
  item: MockItem;
  onPress?: () => void;
  width?: number;
};

/**
 * 商品カード：サムネイル＋商品名＋カテゴリ＋出品者＋🌱水やり数。
 * ホーム「みんなの種」の横スクロール／検索結果で使用。
 */
export function ItemCard({ item, onPress, width = 168 }: Props) {
  const owner = getUser(item.ownerId);
  return (
    <PressableScale onPress={onPress} activeScale={0.97} style={[styles.card, { width }, shadows.card]}>
      <View style={styles.thumbWrap}>
        <Thumb source={item.local} uri={item.image} style={styles.thumb} markSize={40} />
        <View style={styles.waterPill}>
          <Sprout size={13} color={colors.white} />
          <Text style={styles.waterText}>{item.waterCount}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.category}>{item.category}</Text>
        <View style={styles.ownerRow}>
          <Avatar uri={owner.avatar} name={owner.nickname} size={18} />
          <Text numberOfLines={1} style={styles.owner}>{owner.nickname}さん</Text>
          <Ionicons name="heart" size={12} color={colors.heart} style={{ marginLeft: 'auto' }} />
          <Text style={styles.like}>{item.likeCount}</Text>
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
  waterText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  body: { padding: spacing.md, gap: 3 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  category: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.cardMuted },
  owner: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, flexShrink: 1 },
  like: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
});
