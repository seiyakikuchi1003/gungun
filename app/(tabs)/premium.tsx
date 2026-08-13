import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { errorMessage } from '@/lib/errorMessage';
import { View, Text, StyleSheet, ScrollView, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';
import { formatPrice } from '@/config/settings';
import { success } from '@/lib/haptics';
import { useTree } from '@/store/tree';
import { useAuth } from '@/store/auth';
import { pay, openBillingPortal } from '@/lib/api/purchases';
import { FormError } from '@/components/ui/FormError';

function makeFeatures(bonus: number): { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] {
  return [
    { icon: 'gift', title: 'ログインボーナス増量', desc: `毎日${bonus}肥料もらえる（通常より増量）` },
    { icon: 'list', title: '欲しいものリスト公開', desc: '植えた種に「欲しいもの」を掲示できる' },
    { icon: 'ribbon', title: 'プレミアムバッジ', desc: 'プロフィールに特別バッジを表示' },
  ];
}

export default function Premium() {
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState(false);
  // 課金前の同意（2026-08-13 指摘）。シートを開くたびに未チェックへ戻す
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings: appSettings, live } = useTree();
  const { profile, reloadProfile } = useAuth();
  const FEATURES = makeFeatures(appSettings.dailyLoginBonusPremium);
  // 加入済みかは DB（profiles.is_premium）が正。画面のフラグでは判断しない
  const joined = live ? Boolean(profile?.isPremium) : false;
  const price = live ? appSettings.premiumMonthly : appSettings.premiumMonthly;

  // 決済はブラウザで行うので、戻ってきたらプロフィールを取り直す
  useEffect(() => {
    if (!live) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reloadProfile().catch(() => {});
    });
    return () => sub.remove();
  }, [live, reloadProfile]);

  /** 加入。実DB接続時は Stripe のサブスクリプションをブラウザで開く */
  const subscribe = async () => {
    if (busy) return;
    if (!live) {
      success();
      setConfirm(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await pay('premium');
      if (res.status === 'paid') {
        setConfirm(false);
        // 付与はサーバが通知を受けてから。少し待って状態を取り直す
        setTimeout(() => { reloadProfile().catch(() => {}); }, 1500);
        setTimeout(() => { reloadProfile().catch(() => {}); }, 4000);
      }
    } catch (e) {
      setError(errorMessage(e, '決済画面を開けませんでした'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.root}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 170 }}>
        <View style={styles.header}><Text style={styles.title}>プレミアム</Text></View>

        <LinearGradient colors={['#F6C560', colors.orange, '#E8901C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, shadows.card]}>
          <Mikan size={72} />
          <Text style={styles.heroTitle}>ぐんぐん プレミアム</Text>
          <Text style={styles.heroSub}>もっと交換をたのしむ、特別プラン</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(price)}</Text>
            <Text style={styles.priceUnit}>/ 月</Text>
          </View>

          {/* CTAは一番上に置く（スクロールしないと登録できない状態を避ける） */}
          <PressableScale
            onPress={() => setConfirm(true)}
            disabled={joined}
            activeScale={0.97}
            style={[styles.heroCta, shadows.button, joined && styles.heroCtaDone]}
          >
            <Text style={[styles.heroCtaText, joined && styles.heroCtaTextDone]}>
              {joined ? 'プレミアム登録済み' : 'プレミアムに登録する'}
            </Text>
            {!joined && <Ionicons name="chevron-forward" size={17} color={colors.orangeDeep} />}
          </PressableScale>
          {/* 加入中は解約・支払い方法の変更に行けるようにする（導線が無かった：2026-08-05 指摘） */}
          {joined && (
            <PressableScale
              onPress={async () => {
                setError(null);
                try {
                  await openBillingPortal();
                } catch (e) {
                  setError(errorMessage(e, '管理ページを開けませんでした'));
                }
              }}
              activeScale={0.97}
              style={styles.manageBtn}
            >
              <Text style={styles.manageText}>プランを管理・解約する</Text>
            </PressableScale>
          )}
        </LinearGradient>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={[styles.feature, shadows.soft]}>
              <View style={styles.featIcon}><Ionicons name={f.icon} size={22} color={colors.premium} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featTitle}>{f.title}</Text>
                <Text style={styles.featDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <Text style={styles.note}>
            {live
              ? '※ Apple Pay・クレジットカードでお支払いいただけます'
              : '※ 料金・提供機能は調整中です（管理画面から変更可能）'}
          </Text>
          {error ? <FormError message={error} /> : null}
        </View>
      </ScrollView>

      {/* 登録の確認 */}
      <BottomSheetModal visible={confirm} onClose={() => { setConfirm(false); setAgreed(false); }}>
        <View style={styles.sheetHead}>
          <Mikan size={56} />
          <Text style={styles.sheetTitle}>ぐんぐん プレミアム</Text>
          <Text style={styles.sheetPrice}>{formatPrice(price)} / 月</Text>
        </View>
        {/* 課金の前に読んでおくべきことを出す。押したら即決済、では後で揉める（2026-08-13 指摘） */}
        <View style={styles.terms}>
          {[
            '毎月同じ日に自動で更新され、料金が請求されます。',
            '解約はマイページ →「プランを管理・解約する」からいつでもできます。',
            '解約しても、その月の残り期間はプレミアムのままご利用いただけます。',
            '日割りでの返金は行っていません。',
          ].map((t) => (
            <View key={t} style={styles.termRow}>
              <Text style={styles.termDot}>・</Text>
              <Text style={styles.termText}>{t}</Text>
            </View>
          ))}
        </View>

        <PressableScale activeScale={0.98} onPress={() => setAgreed((v) => !v)} style={styles.agreeRow}>
          <View style={[styles.agreeBox, agreed && styles.agreeBoxOn]}>
            {agreed && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
          <Text style={styles.agreeText}>
            上記の内容と
            <Text style={styles.link} onPress={() => router.push('/mypage/terms')}>利用規約</Text>
            ・
            <Text style={styles.link} onPress={() => router.push('/mypage/privacy')}>プライバシーポリシー</Text>
            に同意します
          </Text>
        </PressableScale>

        <PressableScale
          onPress={subscribe}
          disabled={busy || !agreed}
          activeScale={0.97}
          style={[styles.sheetBtn, shadows.button, (busy || !agreed) && { opacity: 0.5 }]}
        >
          <Ionicons name="diamond" size={18} color={colors.white} />
          <Text style={styles.sheetBtnText}>{busy ? '開いています…' : '同意して登録する'}</Text>
        </PressableScale>
        <PressableScale onPress={() => { setConfirm(false); setAgreed(false); }} activeScale={0.98} style={styles.sheetCancel}>
          <Text style={styles.sheetCancelText}>あとで</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  terms: { gap: 6, marginBottom: spacing.md },
  termRow: { flexDirection: 'row', alignItems: 'flex-start' },
  termDot: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  termText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  agreeBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  agreeBoxOn: { backgroundColor: colors.green, borderColor: colors.green },
  agreeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 20, color: colors.textPrimary },
  link: { fontFamily: fonts.bold, color: colors.green, textDecorationLine: 'underline' },
  root: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', paddingBottom: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary },
  hero: { marginHorizontal: 20, borderRadius: radius.lg, padding: spacing['2xl'], alignItems: 'center', gap: 4 },
  heroTitle: { fontFamily: fonts.black, fontSize: 22, color: colors.white, marginTop: spacing.sm },
  heroSub: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: spacing.md },
  price: { fontFamily: fonts.black, fontSize: 32, color: colors.white },
  priceUnit: { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginBottom: 6 },
  heroCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, alignSelf: 'stretch', height: 52, borderRadius: radius.pill, backgroundColor: colors.white, marginTop: spacing.lg },
  heroCtaDone: { backgroundColor: 'rgba(255,255,255,0.28)' },
  heroCtaText: { fontFamily: fonts.black, fontSize: 16, color: colors.orangeDeep },
  heroCtaTextDone: { color: colors.white },
  manageBtn: { marginTop: spacing.md, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  manageText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  heroNote: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 8 },
  features: { paddingHorizontal: 20, marginTop: spacing.xl, gap: spacing.md },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg },
  featIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7EAC9', justifyContent: 'center', alignItems: 'center' },
  featTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  featDesc: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  ctaWrap: { paddingHorizontal: 20, marginTop: spacing.xl, gap: spacing.md },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  sheetHead: { alignItems: 'center', gap: 2, marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.black, fontSize: 19, color: colors.textPrimary, marginTop: spacing.sm },
  sheetPrice: { fontFamily: fonts.black, fontSize: 22, color: colors.orangeDeep },
  sheetNote: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  sheetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.pill, backgroundColor: colors.orange },
  sheetBtnText: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.white },
  sheetCancel: { height: 46, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs },
  sheetCancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
});
