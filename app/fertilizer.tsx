import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/Button';
import { settings, formatPrice } from '@/config/settings';
import { useMe } from '@/store/me';

export default function Fertilizer() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState<string>(settings.chargePlans[1].id);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>肥料チャージ</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <LinearGradient colors={[colors.green, colors.greenDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balance, shadows.card]}>
          <Text style={styles.balanceLabel}>現在の肥料</Text>
          <View style={styles.balanceRow}>
            <Ionicons name="leaf" size={22} color={colors.white} />
            <Text style={styles.balanceNum}>{me.fertilizer}</Text>
            <Text style={styles.balanceUnit}>肥料</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>チャージするプランを選択</Text>
        {settings.chargePlans.map((p) => {
          const on = p.id === sel;
          return (
            <PressableScale key={p.id} activeScale={0.98} onPress={() => setSel(p.id)} style={[styles.plan, shadows.soft, on && styles.planOn]}>
              <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
              <View style={styles.planLeft}>
                <Ionicons name="leaf" size={20} color={colors.green} />
                <Text style={styles.planFert}>{p.fertilizer.toLocaleString()}肥料</Text>
                {p.badge ? <Text style={styles.planBadge}>{p.badge}</Text> : null}
              </View>
              <Text style={styles.planPrice}>{formatPrice(p.price)}</Text>
            </PressableScale>
          );
        })}

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.noteText}>金額は調整中です。確定後、管理画面から反映されます。</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title="Apple Pay で購入する"
          leftIcon={<Ionicons name="logo-apple" size={20} color={colors.white} />}
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  balance: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.xl },
  balanceLabel: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 },
  balanceNum: { fontFamily: fonts.black, fontSize: 36, color: colors.white, includeFontPadding: false },
  balanceUnit: { fontFamily: fonts.bold, fontSize: 15, color: colors.white, marginBottom: 6 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 2, borderColor: 'transparent' },
  planOn: { borderColor: colors.green },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: colors.green },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.green },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  planFert: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  planBadge: { fontFamily: fonts.bold, fontSize: 11, color: colors.orangeDeep, backgroundColor: colors.orangeSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  planPrice: { fontFamily: fonts.black, fontSize: 18, color: colors.green },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  noteText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
});
