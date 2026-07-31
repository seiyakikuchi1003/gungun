import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { useTree } from '@/store/tree';

/**
 * 利用規約。本文は app_settings.terms_of_service に格納する（差替え可能）。
 * 2026-07-28 MTG：決済がStripeになったため規約を差し替えられる形にする。
 */
export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useTree();
  const body = settings.termsOfService?.trim() || DEFAULT_TERMS;
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>利用規約</Text>
        <View style={styles.hBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.text}>{body}</Text>
      </ScrollView>
    </View>
  );
}

const DEFAULT_TERMS =
  '本文は準備中です。最新の利用規約はサービス提供者から公開されます。\n\n' +
  '（管理画面の「アプリ設定 → 利用規約 本文」から差し替え可能）';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  body: { padding: 20, paddingBottom: 60 },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 24, color: colors.textPrimary },
});
