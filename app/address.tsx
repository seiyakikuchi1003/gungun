import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { NoticeBox } from '@/components/ui/NoticeBox';

export default function Address() {
  const insets = useSafeAreaInsets();
  const [f, setF] = useState({ last: '', first: '', phone: '', postal: '', pref: '', city: '', street: '', building: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const ok = f.last && f.first && f.phone && f.postal && f.pref && f.city && f.street;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>お届け先の登録</Text>
        <View style={styles.hBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <NoticeBox text="初めての出品前に、発送のためのお届け先が必要です" />
          <View style={styles.form}>
            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}><TextField label="姓" placeholder="山田" value={f.last} onChangeText={set('last')} /></View>
              <View style={{ flex: 1 }}><TextField label="名" placeholder="太郎" value={f.first} onChangeText={set('first')} /></View>
            </View>
            <TextField label="電話番号" placeholder="09012345678" keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
            <TextField label="郵便番号" placeholder="1234567" keyboardType="number-pad" value={f.postal} onChangeText={set('postal')} />
            <TextField label="都道府県" placeholder="東京都" value={f.pref} onChangeText={set('pref')} />
            <TextField label="市区町村" placeholder="渋谷区〇〇" value={f.city} onChangeText={set('city')} />
            <TextField label="番地" placeholder="1-2-3" value={f.street} onChangeText={set('street')} />
            <TextField label="建物名・部屋番号（任意）" placeholder="〇〇マンション101" value={f.building} onChangeText={set('building')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button title="保存する" disabled={!ok} onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  form: { gap: spacing.lg, marginTop: spacing.lg },
  rowFields: { flexDirection: 'row', gap: spacing.md },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg },
});
