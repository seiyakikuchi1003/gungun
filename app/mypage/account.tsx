import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { success } from '@/lib/haptics';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.card, shadows.soft]}>{children}</View>
    </View>
  );
}
function Row({ label, value, onPress, last }: { label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <PressableScale onPress={onPress} activeScale={0.99} style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textPlaceholder} /> : null}
      </View>
    </PressableScale>
  );
}

const NOTIF = [
  { key: 'watered', label: '水やり' },
  { key: 'harvested', label: '収穫' },
  { key: 'ship', label: '発送・受け取り' },
  { key: 'message', label: '取引メッセージ' },
  { key: 'board', label: '掲示板コメント' },
];

export default function Account() {
  const insets = useSafeAreaInsets();
  const [toggles, setToggles] = useState<Record<string, boolean>>({ watered: true, harvested: true, ship: true, message: true, board: false });
  const [mailSheet, setMailSheet] = useState(false);
  const [mail, setMail] = useState('demo@gungun.app');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>個人情報設定</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Section title="アカウント">
          <Row label="ニックネーム" value="めたん" onPress={() => router.push('/mypage/edit')} />
          <Row label="メールアドレス" value="demo@gungun.app" onPress={() => setMailSheet(true)} />
          <Row label="パスワード" value="変更する" onPress={() => router.push('/(auth)/reset')} last />
        </Section>

        <Section title="お届け先・連絡先">
          <Row label="お届け先" value="未登録" onPress={() => router.push('/address')} />
          <Row label="電話番号" value="未登録" onPress={() => router.push('/address')} last />
        </Section>

        <Section title="通知設定">
          {NOTIF.map((n, i) => (
            <View key={n.key} style={[styles.row, i < NOTIF.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{n.label}</Text>
              <Switch
                value={toggles[n.key]}
                onValueChange={(v) => setToggles((t) => ({ ...t, [n.key]: v }))}
                trackColor={{ true: colors.green, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </Section>
      </ScrollView>

      {/* メールアドレスの変更 */}
      <BottomSheetModal visible={mailSheet} onClose={() => setMailSheet(false)}>
        <Text style={styles.sheetTitle}>メールアドレスの変更</Text>
        <Text style={styles.sheetNote}>新しいアドレスに確認メールを送ります</Text>
        <TextInput
          value={mail}
          onChangeText={setMail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="mail@example.com"
          placeholderTextColor={colors.textPlaceholder}
          style={[styles.sheetInput, { outlineStyle: 'none' } as object]}
        />
        <PressableScale
          onPress={() => { success(); setMailSheet(false); }}
          activeScale={0.97}
          style={[styles.sheetBtn, shadows.button]}
        >
          <Text style={styles.sheetBtnText}>確認メールを送る</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm, marginLeft: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 56 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowValue: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  sheetNote: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  sheetInput: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  sheetBtn: { height: 52, borderRadius: radius.pill, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  sheetBtnText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
