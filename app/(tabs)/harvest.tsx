import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Badge } from '@/components/ui/Badge';
import { Sprout } from '@/components/art/Sprout';
import { items, MockItem } from '@/data/mock';

// 自分（めたん）が植えたタネ＋デモ用に人気の種も表示
const mySeeds: (MockItem & { tradeStatus: 'growing' | 'trading' })[] = [
  { ...items.find((i) => i.id === 'switch')!, tradeStatus: 'growing' },
  { ...items.find((i) => i.id === 'coffee')!, tradeStatus: 'trading' },
  { ...items.find((i) => i.id === 'giftcard')!, tradeStatus: 'growing' },
];

export default function HarvestScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>収穫</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}>
        <View style={styles.intro}>
          <Sprout size={20} />
          <Text style={styles.introText}>あなたが植えたタネと、集まった商品（水やり）です</Text>
        </View>

        {mySeeds.map((s) => (
          <PressableScale key={s.id} activeScale={0.98} onPress={() => router.push(`/harvest/${s.id}`)} style={[styles.card, shadows.card]}>
            <Thumb source={s.local} uri={s.image} style={styles.thumb} radius={radius.md} markSize={30} />
            <View style={{ flex: 1 }}>
              <View style={styles.cardHead}>
                <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                <Badge label={s.tradeStatus === 'trading' ? '取引中' : '出品中'} tone={s.tradeStatus === 'trading' ? 'orange' : 'green'} />
              </View>
              <Text style={styles.category}>{s.category}</Text>
              <View style={styles.metaRow}>
                <Sprout size={15} />
                <Text style={styles.meta}>水やり <Text style={styles.metaNum}>{s.waterCount}</Text></Text>
                <Text style={styles.meta}>木全体 <Text style={styles.metaNum}>{s.treeCount}</Text>件</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textPlaceholder} />
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: spacing.md, alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  introText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md, marginBottom: spacing.md },
  thumb: { width: 72, height: 72 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary, flexShrink: 1 },
  category: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  metaNum: { fontFamily: fonts.bold, color: colors.green },
});
