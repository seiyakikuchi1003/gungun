import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { Thumb } from '@/components/ui/Thumb';
import { Badge } from '@/components/ui/Badge';
import { StarRating } from '@/components/ui/StarRating';
import { getUser } from '@/data/mock';
import { useTree } from '@/store/tree';
import { useMe } from '@/store/me';
import { useBlocks } from '@/store/blocks';

/**
 * 他のユーザーのプロフィール。
 * 商品詳細の出品者カード（›付き）からの遷移先。
 * 自分自身ならマイページへ寄せる。
 */
export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const insets = useSafeAreaInsets();
  const { items } = useTree();
  const { isBlocked, block, unblock } = useBlocks();

  const userId = String(id);
  const u = getUser(userId);
  const blocked = isBlocked(userId);
  const isMe = userId === me.id;
  const listed = items.filter((i) => i.ownerId === userId);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle} numberOfLines={1}>{u.nickname}さん</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={[styles.profile, shadows.soft]}>
          <Avatar uri={u.avatar} name={u.nickname} size={72} />
          <Text style={styles.name}>{u.nickname}さん</Text>
          <View style={styles.ratingRow}>
            <StarRating value={4.5} size={14} gap={2} />
            <Text style={styles.stat}>評価 {u.ratingCount}・出品 {u.itemCount}</Text>
          </View>

          {!isMe && (
            <PressableScale
              onPress={() => (blocked ? unblock(userId) : block(userId))}
              activeScale={0.96}
              style={[styles.blockBtn, blocked && styles.blockBtnOn]}
            >
              <Ionicons
                name={blocked ? 'lock-open-outline' : 'ban-outline'}
                size={16}
                color={blocked ? colors.textSecondary : colors.heart}
              />
              <Text style={[styles.blockText, blocked && styles.blockTextOn]}>
                {blocked ? 'ブロックを解除' : 'このユーザーをブロック'}
              </Text>
            </PressableScale>
          )}
        </View>

        <Text style={styles.sectionTitle}>出品中の商品</Text>
        {listed.map((it) => (
          <PressableScale
            key={it.id}
            activeScale={0.98}
            onPress={() => router.push(`/item/${it.id}`)}
            style={[styles.card, shadows.soft]}
          >
            <Thumb source={it.local} uri={it.image} style={styles.thumb} radius={radius.md} markSize={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
              <Text style={styles.category}>{it.category}</Text>
              <View style={styles.metaRow}>
                <Badge label={it.status === 'growing' ? '出品中' : '取引中'} tone={it.status === 'growing' ? 'green' : 'orange'} />
                <Text style={styles.meta}>♡ {it.likeCount}・水やり {it.waterCount}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textPlaceholder} />
          </PressableScale>
        ))}
        {listed.length === 0 && <Text style={styles.empty}>出品中の商品はありません</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  profile: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.xl, marginBottom: spacing.xl },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginTop: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  stat: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  // alignSelf を付けないと親の alignItems:'center' で潰れるので、幅は自分で決める
  blockBtn: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.heart, marginTop: spacing.md },
  blockBtnOn: { borderColor: colors.border },
  blockText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.heart },
  blockTextOn: { color: colors.textSecondary },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md },
  thumb: { width: 64, height: 64 },
  itemName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  category: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  empty: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
