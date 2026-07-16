import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Mikan } from '@/components/art/Mikan';
import { settings, formatPrice } from '@/config/settings';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  { icon: 'gift', title: 'ログインボーナス増量', desc: '毎日もらえる肥料がアップ' },
  { icon: 'list', title: '欲しいものリスト公開', desc: '植えた種に「欲しいもの」を掲示できる' },
  { icon: 'flash', title: '出品がもっと快適に', desc: '水やりの肥料消費をサポート' },
  { icon: 'ribbon', title: 'プレミアムバッジ', desc: 'プロフィールに特別バッジを表示' },
];

export default function Premium() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 150 }}>
        <View style={styles.header}><Text style={styles.title}>プレミアム</Text></View>

        <LinearGradient colors={['#F6C560', colors.orange, '#E8901C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, shadows.card]}>
          <Mikan size={72} />
          <Text style={styles.heroTitle}>ぐんぐん プレミアム</Text>
          <Text style={styles.heroSub}>もっと交換をたのしむ、特別プラン</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(settings.premiumMonthly)}</Text>
            <Text style={styles.priceUnit}>/ 月</Text>
          </View>
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
          <Button title="プレミアムに登録する" variant="accent" onPress={() => {}} />
          <Text style={styles.note}>※ 料金・提供機能は調整中です（管理画面から変更可能）</Text>
        </View>
      </ScrollView>
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
  features: { paddingHorizontal: 20, marginTop: spacing.xl, gap: spacing.md },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg },
  featIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7EAC9', justifyContent: 'center', alignItems: 'center' },
  featTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  featDesc: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  ctaWrap: { paddingHorizontal: 20, marginTop: spacing.xl, gap: spacing.md },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
