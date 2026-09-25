import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { useTree } from '@/store/tree';
import { LegalDocument } from '@/components/feature/LegalDocument';
import { lh } from '@/lib/fontScale';

/**
 * 特定商取引法に基づく表記。本文は app_settings.commerce_disclosure に格納する。
 * 肥料とプレミアムを販売しているため、購入画面とマイページから開けるようにしておく（2026-09-25）。
 */
export default function CommerceDisclosureScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useTree();
  const body = settings.commerceDisclosure?.trim() || DEFAULT_BODY;
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>特定商取引法に基づく表記</Text>
        <View style={styles.hBtn} />
      </View>
      <LegalDocument title="特定商取引法に基づく表記" body={body} />
    </View>
  );
}

const DEFAULT_BODY =
  '本文は準備中です。\n\n' +
  '（管理画面の「アプリ設定 → 特定商取引法に基づく表記」から差し替え可能）';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  body: { padding: 20, paddingBottom: 60 },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: lh(24), color: colors.textPrimary },
});
