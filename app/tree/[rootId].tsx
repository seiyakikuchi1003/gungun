import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { StarRating } from '@/components/ui/StarRating';
import { Sprout } from '@/components/art/Sprout';
import { TreeCanvas } from '@/components/feature/TreeCanvas';
import { getUser, currentUser } from '@/data/mock';
import { useTree } from '@/store/tree';

export default function TreeScreen() {
  const { rootId, new: newId } = useLocalSearchParams<{ rootId: string; new?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getItem, childrenOf, treeItems } = useTree();
  const [showAll, setShowAll] = useState(false);

  const root = getItem(rootId ?? '');
  if (!root) return <View style={styles.root} />;

  const owner = getUser(root.ownerId);
  const mine = root.ownerId === currentUser.id;
  const rootChildren = childrenOf(root.id);
  const all = treeItems(root.id).sort((a, b) => a.depth - b.depth);
  const waterings = all.length - 1;
  const branches = rootChildren.length;
  const harvestable = mine && waterings > 0 ? 1 : 0;
  const justWatered = !!newId;
  const cardW = width - 40;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => (justWatered ? router.replace('/(tabs)') : router.back())} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name={justWatered ? 'close' : 'chevron-back'} size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>木の様子（マイツリー）</Text>
        <PressableScale onPress={() => router.push('/water/about')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* 完了バナー */}
        {justWatered && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.doneBanner}>
            <View style={styles.doneIcon}><Ionicons name="checkmark" size={22} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doneTitle}>水やりが完了しました！</Text>
              <Text style={styles.doneSub}>あなたの商品が木に追加されました🌱</Text>
            </View>
          </Animated.View>
        )}

        {/* 元の種 */}
        <Text style={styles.blockLabel}>元の種（{mine ? 'あなたの出品' : `${owner.nickname}さんの出品`}）</Text>
        <View style={[styles.rootCard, shadows.soft]}>
          <Thumb source={root.local} uri={root.image} style={styles.rootThumb} radius={radius.md} markSize={22} />
          <View style={{ flex: 1 }}>
            <View style={styles.rootTop}>
              <Text style={styles.rootName} numberOfLines={1}>{root.name}</Text>
              <Badge label={root.status === 'growing' ? '成長中' : '取引中'} tone={root.status === 'growing' ? 'green' : 'orange'} />
            </View>
            <View style={styles.rootMeta}>
              <Avatar uri={owner.avatar} name={owner.nickname} size={18} />
              <Text style={styles.rootOwner}>{owner.nickname}さん</Text>
              <StarRating value={4.5} size={12} gap={1} />
              <Text style={styles.rootSub}>(12)</Text>
            </View>
            <Text style={styles.rootSub}>水やり数：{root.waterCount}</Text>
          </View>
        </View>

        {/* 木のイラスト */}
        <View style={[styles.canvasCard, shadows.card]}>
          <TreeCanvas
            width={cardW - 4}
            children={rootChildren}
            highlightId={newId}
            onPressNode={(it) => router.push(`/item/${it.id}`)}
            mascotText="すくすく育ってるよ！"
          />
        </View>

        {/* 統計 */}
        <View style={styles.statRow}>
          <Stat num={waterings} label="水やり数" />
          <View style={styles.statDivider} />
          <Stat num={branches} label="枝分かれ" />
          <View style={styles.statDivider} />
          <Stat num={harvestable} label="収穫できる" accent />
        </View>

        {/* アクション */}
        {justWatered ? (
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <PressableScale onPress={() => setShowAll(true)} activeScale={0.97} style={[styles.shareBtn, shadows.button]}>
              <Sprout size={18} color={colors.white} />
              <Text style={styles.shareText}>木の様子をくわしく見る</Text>
            </PressableScale>
            <PressableScale onPress={() => router.replace('/(tabs)')} activeScale={0.97} style={styles.ghostBtn}>
              <Text style={styles.ghostText}>ホームに戻る</Text>
            </PressableScale>
          </View>
        ) : (
          <PressableScale onPress={() => {}} activeScale={0.97} style={[styles.shareBtn, shadows.button, { marginTop: spacing.xl }]}>
            <Ionicons name="share-social" size={18} color={colors.white} />
            <Text style={styles.shareText}>あなたのツリーをシェア</Text>
          </PressableScale>
        )}

        {/* この木の全商品 */}
        <PressableScale onPress={() => setShowAll((v) => !v)} activeScale={0.98} style={styles.allToggle}>
          <Sprout size={16} />
          <Text style={styles.allToggleText}>この木の全商品（{all.length}）</Text>
          <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </PressableScale>

        {showAll && (
          <Animated.View entering={FadeIn.duration(250)} style={{ gap: spacing.sm }}>
            {all.map((it) => {
              const u = getUser(it.ownerId);
              const isNew = it.id === newId;
              return (
                <PressableScale key={it.id} activeScale={0.98} onPress={() => router.push(`/item/${it.id}`)} style={[styles.allRow, shadows.soft, isNew && styles.allRowNew, { marginLeft: Math.min(it.depth, 3) * 16 }]}>
                  {it.depth > 0 && <View style={styles.branchMark} />}
                  <Thumb source={it.local} uri={it.image} style={styles.allThumb} radius={10} markSize={18} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.allTop}>
                      <Text style={styles.allName} numberOfLines={1}>{it.name}</Text>
                      {isNew && <View style={styles.newTag}><Text style={styles.newTagText}>NEW</Text></View>}
                    </View>
                    <View style={styles.allMeta}>
                      <Avatar uri={u.avatar} name={u.nickname} size={15} />
                      <Text style={styles.allOwner}>{u.nickname}さん</Text>
                      <Text style={styles.allSub}>水やり数：{it.waterCount}</Text>
                    </View>
                  </View>
                  <Badge label={it.depth === 0 ? '元の種' : '成長中'} tone="green" />
                </PressableScale>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ num, label, accent }: { num: number; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statNum, accent && { color: colors.orange }]}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  doneBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.greenSoftBorder },
  doneIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  doneTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.greenDeep },
  doneSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  blockLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  rootCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  rootThumb: { width: 54, height: 54 },
  rootTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rootName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
  rootMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rootOwner: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  rootSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginTop: 3 },
  canvasCard: { backgroundColor: colors.bgWarm, borderRadius: radius.lg, marginTop: spacing.lg, paddingVertical: spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: spacing.lg, marginTop: spacing.lg, ...shadows.soft },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontFamily: fonts.black, fontSize: 24, color: colors.green },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  statDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.green },
  shareText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  ghostBtn: { alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ghostText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  allToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing['2xl'], marginBottom: spacing.md, paddingVertical: spacing.sm },
  allToggleText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  allRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  allRowNew: { borderWidth: 1.5, borderColor: colors.orange },
  branchMark: { position: 'absolute', left: -10, width: 10, height: 2, backgroundColor: colors.greenSoftBorder },
  allThumb: { width: 46, height: 46 },
  allTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  allName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
  newTag: { backgroundColor: colors.orange, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill },
  newTagText: { fontFamily: fonts.black, fontSize: 8, color: colors.white },
  allMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  allOwner: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  allSub: { fontFamily: fonts.medium, fontSize: 11, color: colors.textPlaceholder },
});
