import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, AppState } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/Button';
import { settings as fallbackSettings, formatPrice } from '@/config/settings';
import { useTree } from '@/store/tree';
import { useAuth } from '@/store/auth';
import { pay } from '@/lib/api/purchases';
import { FormError } from '@/components/ui/FormError';

export default function Fertilizer() {
  const insets = useSafeAreaInsets();
  // 残高は tree ストアが持つ（モックでも増減する）。me.fertilizer は初期値なので使わない
  const { fertilizer, addFertilizer, settings: appSettings, live } = useTree();
  const { reloadProfile } = useAuth();
  // 販売プランは DB（app_settings.charge_plans）から。未接続時はモックの既定値
  const plans = live
    ? appSettings.chargePlans
    : fallbackSettings.chargePlans.map((p) => ({ ...p, price: p.price ?? 0, badge: p.badge ?? '' }));
  const [sel, setSel] = useState<string>(plans[1]?.id ?? plans[0].id);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = plans.find((p) => p.id === sel) ?? plans[0];

  // 決済はブラウザで行うので、アプリに戻ってきたら残高を取り直す。
  // 付与は Stripe の通知を受けたサーバ側が行うため、ここでは読むだけ。
  useEffect(() => {
    if (!live) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reloadProfile().catch(() => {});
    });
    return () => sub.remove();
  }, [live, reloadProfile]);

  /**
   * 購入。実DB接続時は Stripe Checkout をブラウザで開く。
   * 未接続（モック）のときは、残高が増えるところまでを見せる。
   */
  const purchase = async () => {
    if (done || busy) return;
    if (!live) {
      addFertilizer(plan.fertilizer);
      setDone(`${plan.fertilizer.toLocaleString()}肥料をチャージしました`);
      // 直リンクで開かれていて戻り先が無いこともあるのでホームへ逃がす
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')), 1200);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await pay('fertilizer', plan.id);
      if (res.status === 'paid') {
        // 付与はサーバが Stripe の通知を受けてから。少し待って残高を取り直す
        setDone(`${plan.fertilizer.toLocaleString()}肥料をチャージしました`);
        setTimeout(() => { reloadProfile().catch(() => {}); }, 1500);
        setTimeout(() => { reloadProfile().catch(() => {}); }, 4000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '支払いを開始できませんでした');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>肥料チャージ</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <LinearGradient colors={[colors.green, colors.greenDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balance, shadows.card]}>
          <Text style={styles.balanceLabel}>現在の肥料</Text>
          <View style={styles.balanceRow}>
            <Ionicons name="leaf" size={22} color={colors.white} />
            <Text style={styles.balanceNum}>{fertilizer.toLocaleString()}</Text>
            <Text style={styles.balanceUnit}>肥料</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>チャージするプランを選択</Text>
        {plans.map((p) => {
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
          <Text style={styles.noteText}>
            {live
              ? 'Apple Pay またはカードでお支払いいただけます。反映まで数秒かかることがあります。'
              : '金額は調整中です。確定後、管理画面から反映されます。'}
          </Text>
        </View>
        {error ? <FormError message={error} /> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {done ? (
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
            <Text style={styles.doneText}>{done}</Text>
          </View>
        ) : (
          <Button
            title={live ? `${formatPrice(plan.price)} を支払う` : 'Apple Pay で購入する'}
            leftIcon={<Ionicons name={live ? 'card' : 'logo-apple'} size={20} color={colors.white} />}
            loading={busy}
            onPress={purchase}
          />
        )}
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
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.greenSoft },
  doneText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.green },
});
