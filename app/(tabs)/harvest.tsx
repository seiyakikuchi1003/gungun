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
import { items, MockItem } from '@/data/mock';

// 自分（めたん）が植えたタネ＋デモ用に人気の種も表示
const mySeeds: (MockItem & { tradeStatus: 'growing' | 'trading' })[] = [
  { ...items.find((i) => i.id === 'switch')!, tradeStatus: 'growing' },
  { ...items.find((i) => i.id === 'coffee')!, tradeStatus: 'trading' },
  { ...items.find((i) => i.id === 'giftcard')!, tradeStatus: 'growing' },
];

/** 木全体の件数に応じた成長段階（畑の見た目に反映） */
function growthOf(s: MockItem): { label: string; emoji: string } {
  if (s.treeCount >= 10) return { label: 'おおきな木', emoji: '🌳' };
  if (s.treeCount >= 4) return { label: 'すくすく成長中', emoji: '🌿' };
  return { label: 'めばえ', emoji: '🌱' };
}

export default function HarvestScreen() {
  const insets = useSafeAreaInsets();
  const totalWater = mySeeds.reduce((a, s) => a + s.waterCount, 0);
  const harvestable = mySeeds.filter((s) => s.tradeStatus === 'growing' && s.waterCount > 0).length;

  return (
    <View style={styles.root}>
      <View style={styles.leafBg} pointerEvents="none">
        <LeafDecor width={200} height={260} opacity={0.3} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 130 }}
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
          const g = growthOf(s);
          const canHarvest = s.tradeStatus === 'growing' && s.waterCount > 0;
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(80 + i * 70).duration(400)}>
              <PressableScale activeScale={0.98} onPress={() => router.push(`/harvest/${s.id}`)} style={[styles.card, shadows.card]}>
                <View style={styles.cardMain}>
                  <Thumb source={s.local} uri={s.image} style={styles.thumb} radius={radius.md} markSize={30} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardHead}>
                      <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                      <Badge label={s.tradeStatus === 'trading' ? '取引中' : '出品中'} tone={s.tradeStatus === 'trading' ? 'orange' : 'green'} />
                    </View>
                    <Text style={styles.growth}>{g.emoji} {g.label}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="water" size={13} color={colors.green} />
                      <Text style={styles.meta}>水やり <Text style={styles.metaNum}>{s.waterCount}</Text></Text>
                      <Sprout size={14} />
                      <Text style={styles.meta}>木全体 <Text style={styles.metaNum}>{s.treeCount}</Text>件</Text>
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
              集まった商品からひとつ選ぶと、そこまでの一本道の全員が輪になって交換します。各自が1回送って1回受け取るだけ。
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
});
