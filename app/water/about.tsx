import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { WateringCan } from '@/components/art/WateringCan';
import { lh } from '@/lib/fontScale';

const POINTS = [
  '対象商品の子として、あなたの商品が出品されます',
  '他のユーザーから水やりされることがあります',
  '収穫が成立すると、玉突き交換の一員になります',
];

export default function WaterAbout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.hBtn} />
        <Text style={styles.hTitle}>水やりとは？</Text>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </PressableScale>
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <WateringCan size={120} />
        </View>

        <Text style={styles.lead}>
          「この商品と交換したい」意思表示であり、{'\n'}<Text style={styles.leadStrong}>自分の商品を出品する行為</Text>です。
        </Text>

        {/* 子 → 親 の図 */}
        <View style={styles.diagram}>
          <View style={styles.diagItem}>
            <View style={[styles.diagCircle, { borderColor: colors.waterBlue }]}>
              <Ionicons name="cube" size={26} color={colors.waterBlue} />
            </View>
            <Text style={styles.diagLabel}>あなた（子）</Text>
          </View>
          <View style={styles.diagArrow}>
            <Text style={styles.diagArrowLabel}>水やり</Text>
            <Ionicons name="arrow-forward" size={22} color={colors.green} />
          </View>
          <View style={styles.diagItem}>
            <View style={[styles.diagCircle, { borderColor: colors.green }]}>
              <Ionicons name="cube" size={26} color={colors.green} />
            </View>
            <Text style={styles.diagLabel}>相手の商品（親）</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>水やりすると…</Text>
        <View style={{ gap: spacing.md }}>
          {POINTS.map((p) => (
            <View key={p} style={[styles.point, shadows.soft]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.green} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>

        <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} activeScale={0.97} style={[styles.okBtn, shadows.button]}>
          <Text style={styles.okText}>わかりました</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  lead: { fontFamily: fonts.medium, fontSize: 15, lineHeight: lh(24), color: colors.textPrimary, textAlign: 'center' },
  leadStrong: { fontFamily: fonts.black, color: colors.green },
  diagram: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: spacing.xl, marginTop: spacing.xl, ...shadows.soft },
  diagItem: { alignItems: 'center', gap: spacing.sm },
  diagCircle: { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, backgroundColor: colors.bgWarm, justifyContent: 'center', alignItems: 'center' },
  diagLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary },
  diagArrow: { alignItems: 'center', gap: 2 },
  diagArrowLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.green },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: spacing['2xl'], marginBottom: spacing.md },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg },
  pointText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: lh(20), color: colors.textPrimary },
  okBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.green, marginTop: spacing['2xl'], paddingVertical: 8, paddingHorizontal: 14 },
  okText: { flexShrink: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.white, },
});
