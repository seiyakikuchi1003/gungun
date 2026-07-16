import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Thumb } from '@/components/ui/Thumb';
import { Sprout } from '@/components/art/Sprout';
import { WaterConfirmSheet } from '@/components/feature/WaterConfirmSheet';
import { getItem, getUser, currentUser, itemImageSources } from '@/data/mock';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const item = getItem(id ?? '');
  const [liked, setLiked] = useState(false);
  const [page, setPage] = useState(0);
  const [showWater, setShowWater] = useState(false);
  const [watered, setWatered] = useState(false);

  if (!item) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>商品が見つかりません</Text>
      </View>
    );
  }
  const owner = getUser(item.ownerId);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={styles.root}>
      {/* ヘッダー */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <View style={styles.hTitle}>
          <Text style={styles.hLogo}>ぐんぐん</Text>
          <Sprout size={18} />
        </View>
        <View style={styles.hRight}>
          <PressableScale activeScale={0.9} style={styles.hBtn}>
            <Ionicons name="sync" size={22} color={colors.textPrimary} />
          </PressableScale>
          <PressableScale activeScale={0.9} style={styles.hBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
          </PressableScale>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* 画像カルーセル */}
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
            {itemImageSources(item).map((src, i) => (
              <Thumb key={i} source={src} style={{ width, height: width * 0.82 }} markSize={90} />
            ))}
          </ScrollView>
          {itemImageSources(item).length > 1 && (
            <View style={styles.dots}>
              {itemImageSources(item).map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.body}>
          {/* タイトル＋いいね */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.category}>{item.category}</Text>
            </View>
            <PressableScale onPress={() => setLiked((l) => !l)} activeScale={0.85} style={styles.likeBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? colors.heart : colors.textSecondary} />
              <Text style={styles.likeCount}>{item.likeCount + (liked ? 1 : 0)}</Text>
            </PressableScale>
          </View>

          {/* 出品者（※ランク表示は v1 対象外のため省略） */}
          <PressableScale activeScale={0.98} style={[styles.sellerCard, shadows.soft]}>
            <Avatar uri={owner.avatar} name={owner.nickname} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{owner.nickname}さん</Text>
              <View style={styles.sellerStats}>
                <Text style={styles.sellerStat}>評価 <Text style={styles.sellerStatNum}>{owner.ratingCount}</Text></Text>
                <Text style={styles.sellerStat}>出品数 <Text style={styles.sellerStatNum}>{owner.itemCount}</Text></Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </PressableScale>

          {/* 元の種 */}
          <PressableScale activeScale={0.98} style={[styles.rootCard, shadows.soft]}>
            <View style={styles.rootTop}>
              <Sprout size={20} />
              <Text style={styles.rootLabel}>元の種（この商品がつながっている種）</Text>
            </View>
            <View style={styles.rootBottom}>
              <Text style={styles.rootSub}>木全体の商品</Text>
              <View style={styles.rootCountRow}>
                <Text style={styles.rootCount}>{item.treeCount}</Text>
                <Text style={styles.rootUnit}>件</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.green} />
              </View>
            </View>
          </PressableScale>

          {/* 説明 */}
          <View style={styles.descBlock}>
            <Text style={styles.descTitle}>商品の説明</Text>
            <Text style={styles.descText}>{item.description}</Text>
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>商品の状態</Text>
              <Text style={styles.conditionValue}>{item.condition}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 水やりボタン */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {watered ? (
          <Animated.View entering={FadeIn} style={styles.wateredPill}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <Text style={styles.wateredText}>水やり済み — 交換の輪に参加中</Text>
          </Animated.View>
        ) : (
          <Button
            title="この商品に水やりする"
            leftIcon={<Ionicons name="water" size={20} color={colors.white} />}
            onPress={() => setShowWater(true)}
          />
        )}
      </View>

      <WaterConfirmSheet
        visible={showWater}
        item={item}
        ownerName={owner.nickname}
        currentFertilizer={currentUser.fertilizer}
        onClose={() => setShowWater(false)}
        onConfirm={() => {
          setShowWater(false);
          setWatered(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  notFoundText: { fontFamily: fonts.medium, color: colors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    zIndex: 5,
  },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hLogo: { fontFamily: fonts.black, fontSize: 20, color: colors.green },
  hRight: { flexDirection: 'row', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', position: 'absolute', bottom: 12, left: 0, right: 0 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { backgroundColor: colors.white, width: 18 },
  body: { paddingHorizontal: 20, paddingTop: spacing.lg, gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontFamily: fonts.bold, fontSize: 23, color: colors.textPrimary },
  category: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, marginTop: 3 },
  likeBtn: { alignItems: 'center', gap: 2, paddingLeft: spacing.md },
  likeCount: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg },
  sellerName: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  sellerStats: { flexDirection: 'row', gap: spacing.lg, marginTop: 3 },
  sellerStat: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  sellerStatNum: { fontFamily: fonts.bold, color: colors.textPrimary },
  rootCard: { backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  rootTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rootLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.green, flex: 1 },
  rootBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rootSub: { fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary },
  rootCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  rootCount: { fontFamily: fonts.black, fontSize: 32, color: colors.green },
  rootUnit: { fontFamily: fonts.bold, fontSize: 15, color: colors.green, marginRight: 2 },
  descBlock: { gap: spacing.sm, paddingTop: spacing.xs },
  descTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  descText: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 24, color: colors.textPrimary },
  conditionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.sm },
  conditionLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  conditionValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.divider },
  wateredPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.greenSoft },
  wateredText: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
});
