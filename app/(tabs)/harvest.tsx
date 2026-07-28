import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Badge } from '@/components/ui/Badge';
import { Sprout } from '@/components/art/Sprout';
import { Mikan } from '@/components/art/Mikan';
import { LeafDecor } from '@/components/art/LeafDecor';
import { currentUser, MockItem, treeGrowth } from '@/data/mock';
import { useTree } from '@/store/tree';

export default function HarvestScreen() {
  const insets = useSafeAreaInsets();
  const { items, treeItems } = useTree();

  // 自分が植えたタネ（parentId=null）＝収穫の起点になれるもの
  // デモの木を見せるため、自分の種が無い場合は水やりが集まっている木も表示する
  const ownSeeds = items.filter((i) => i.parentId === null && i.ownerId === currentUser.id);
  const demoSeeds = items
    .filter((i) => i.parentId === null && treeItems(i.id).length > 1)
    .slice(0, 3);
  const mySeeds: MockItem[] = ownSeeds.length > 0 ? ownSeeds : demoSeeds;

  /** その木にぶら下がっている件数（種を含む） */
  const treeSizeOf = (s: MockItem) => treeItems(s.id).length;
  /** 集まった水やり＝木の件数 - 種 */
  const gatheredOf = (s: MockItem) => Math.max(0, treeSizeOf(s) - 1);

  const totalWater = mySeeds.reduce((a, s) => a + gatheredOf(s), 0);
  const harvestable = mySeeds.filter((s) => s.status === 'growing' && gatheredOf(s) > 0).length;

  return (
    <View style={styles.root}>
      <View style={styles.leafBg} pointerEvents="none">
        <LeafDecor width={200} height={260} opacity={0.3} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 170 }}
      >
        {/* ヘッダー */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>あなたの畑</Text>
              <Text style={styles.subtitle}>植えたタネが、交換の輪に育ちます</Text>
            </View>
            <Mikan size={46} />
          </View>

          {/* 畑のサマリー */}
          <LinearGradient
            colors={[colors.green, colors.greenDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.summary, shadows.card]}
          >
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNum}>{mySeeds.length}</Text>
              <Text style={styles.summaryLabel}>植えたタネ</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNum}>{totalWater}</Text>
              <Text style={styles.summaryLabel}>集まった水やり</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={[styles.summaryNum, { color: '#FFE2AE' }]}>{harvestable}</Text>
              <Text style={styles.summaryLabel}>収穫できる</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* タネ一覧 */}
        <Text style={styles.sectionTitle}>植えたタネ</Text>
        {mySeeds.map((s, i) => {
          const size = treeSizeOf(s);
          const gathered = gatheredOf(s);
          const g = treeGrowth(size);
          const canHarvest = s.status === 'growing' && gathered > 0;
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(80 + i * 70).duration(400)}>
              <PressableScale activeScale={0.98} onPress={() => router.push(`/harvest/${s.id}`)} style={[styles.card, shadows.card]}>
                <View style={styles.cardMain}>
                  <Thumb source={s.local} uri={s.image} style={styles.thumb} radius={radius.md} markSize={30} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardHead}>
                      <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                      <Badge label={s.status === 'trading' ? '取引中' : '出品中'} tone={s.status === 'trading' ? 'orange' : 'green'} />
                    </View>
                    <Text style={styles.growth}>{g.emoji} {g.label}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="water" size={13} color={colors.green} />
                      <Text style={styles.meta}>集まった商品 <Text style={styles.metaNum}>{gathered}</Text></Text>
                      <Sprout size={14} />
                      <Text style={styles.meta}>木全体 <Text style={styles.metaNum}>{size}</Text>件</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textPlaceholder} />
                </View>
                {canHarvest && (
                  <View style={styles.harvestHint}>
                    <Ionicons name="sparkles" size={13} color={colors.orangeDeep} />
                    <Text style={styles.harvestHintText}>水やりが集まっています。収穫できます！</Text>
                    <Text style={styles.harvestHintCta}>見る ›</Text>
                  </View>
                )}
              </PressableScale>
            </Animated.View>
          );
        })}

        {/* 使い方のヒント */}
        <Animated.View entering={FadeInDown.delay(340).duration(400)} style={[styles.tipCard, shadows.soft]}>
          <View style={styles.tipIcon}>
            <Ionicons name="bulb" size={18} color={colors.orangeDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>収穫のしくみ</Text>
            <Text style={styles.tipBody}>
              集まった商品からひとつ選ぶと、<Text style={styles.tipStrong}>選んだ商品までの一本道の人だけ</Text>が輪になって交換します。
              別の枝や、その先に続く人は輪に入らず、新しいタネとして独立します。各自が1回送って1回受け取るだけ。
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  leafBg: { position: 'absolute', right: -40, top: -20 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  title: { fontFamily: fonts.black, fontSize: 24, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm, marginBottom: spacing['2xl'] },
  summaryCol: { flex: 1, alignItems: 'center', gap: 2 },
  summaryNum: { fontFamily: fonts.black, fontSize: 26, color: colors.white },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.85)' },
  summaryDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.25)' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.card, marginBottom: spacing.md, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: { width: 72, height: 72 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary, flexShrink: 1 },
  growth: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginRight: spacing.sm },
  metaNum: { fontFamily: fonts.bold, color: colors.green },
  harvestHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeSoft, paddingHorizontal: spacing.md, paddingVertical: 9 },
  harvestHintText: { flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.orangeDeep },
  harvestHintCta: { fontFamily: fonts.bold, fontSize: 12, color: colors.orangeDeep },
  tipCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.bgWarm, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  tipIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.orangeSoft, justifyContent: 'center', alignItems: 'center' },
  tipTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: 3 },
  tipBody: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
  tipStrong: { fontFamily: fonts.bold, color: colors.green },
});
