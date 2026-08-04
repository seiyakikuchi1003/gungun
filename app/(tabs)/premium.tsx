import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';
import { settings, formatPrice } from '@/config/settings';
import { success } from '@/lib/haptics';
import { useTree } from '@/store/tree';

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
  const [joined, setJoined] = useState(false);
  const { settings: appSettings } = useTree();
  const FEATURES = makeFeatures(appSettings.dailyLoginBonusPremium);
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
            <Text style={styles.price}>{formatPrice(settings.premiumMonthly)}</Text>
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
          <Text style={styles.heroNote}>いつでも解約できます</Text>
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
          <Text style={styles.note}>※ 料金・提供機能は調整中です（管理画面から変更可能）</Text>
        </View>
      </ScrollView>

      {/* 登録の確認 */}
      <BottomSheetModal visible={confirm} onClose={() => setConfirm(false)}>
        <View style={styles.sheetHead}>
          <Mikan size={56} />
          <Text style={styles.sheetTitle}>ぐんぐん プレミアム</Text>
          <Text style={styles.sheetPrice}>{formatPrice(settings.premiumMonthly)} / 月</Text>
        </View>
        <Text style={styles.sheetNote}>
          いつでも解約できます。料金は調整中のため、正式提供時に改めてご案内します。
        </Text>
        <PressableScale
          onPress={() => { success(); setJoined(true); setConfirm(false); }}
          activeScale={0.97}
          style={[styles.sheetBtn, shadows.button]}
        >
          <Ionicons name="diamond" size={18} color={colors.white} />
          <Text style={styles.sheetBtnText}>登録する</Text>
        </PressableScale>
        <PressableScale onPress={() => setConfirm(false)} activeScale={0.98} style={styles.sheetCancel}>
          <Text style={styles.sheetCancelText}>あとで</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
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
