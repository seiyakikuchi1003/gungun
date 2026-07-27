import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { ItemCard } from '@/components/ui/ItemCard';
import { Thumb } from '@/components/ui/Thumb';
import { Sprout } from '@/components/art/Sprout';
import { getItem, getUser, items } from '@/data/mock';

export default function RootDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const seed = getItem(id ?? '');
  const cardW = (width - 20 * 2 - 12) / 2;
  if (!seed) return <View style={styles.root} />;
  const owner = getUser(seed.ownerId);
  const connected = items.filter((i) => i.id !== seed.id).slice(0, seed.treeCount);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>元の種</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* 根の種 */}
        <View style={[styles.rootCard, shadows.card]}>
          <Thumb source={seed.local} uri={seed.image} style={styles.rootThumb} radius={radius.md} markSize={34} />
          <View style={{ flex: 1 }}>
            <View style={styles.rootBadge}><Sprout size={14} color={colors.white} /><Text style={styles.rootBadgeText}>元の種</Text></View>
            <Text style={styles.rootName}>{seed.name}</Text>
            <Text style={styles.rootOwner}>{owner.nickname}さんが植えたタネ</Text>
          </View>
        </View>

        <View style={styles.treeStat}>
          <View style={styles.treeStatItem}>
            <Text style={styles.treeNum}>{seed.treeCount}</Text>
            <Text style={styles.treeLabel}>木全体の商品</Text>
          </View>
          <View style={styles.treeDivider} />
          <View style={styles.treeStatItem}>
            <Text style={styles.treeNum}>{seed.waterCount}</Text>
            <Text style={styles.treeLabel}>直接の水やり</Text>
          </View>
        </View>

        <View style={styles.noticeBox}>
          <Sprout size={20} />
          <Text style={styles.noticeText}>この種に水やりすると、あなたの商品が交換の輪に加わります</Text>
        </View>

        <Text style={styles.sectionTitle}>つながっている商品</Text>
        <View style={styles.grid}>
          {connected.map((i) => (
            <ItemCard key={i.id} item={i} width={cardW} onPress={() => router.push(`/item/${i.id}`)} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <PressableScale onPress={() => router.push(`/item/${seed.id}`)} style={[styles.waterBtn, shadows.button]}>
          <Ionicons name="water" size={20} color={colors.white} />
          <Text style={styles.waterText}>この種に水やりする</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  rootCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  rootThumb: { width: 76, height: 76 },
  rootBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  rootBadgeText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  rootName: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginTop: 5 },
  rootOwner: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  treeStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radius.card, paddingVertical: spacing.lg, marginTop: spacing.lg },
  treeStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  treeNum: { fontFamily: fonts.black, fontSize: 26, color: colors.green },
  treeLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textPrimary },
  treeDivider: { width: 1, height: 32, backgroundColor: colors.greenSoftBorder },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  waterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.waterBlue },
  waterText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
