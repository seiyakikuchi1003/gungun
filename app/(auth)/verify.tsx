import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';

export default function Verify() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const refs = useRef<(TextInput | null)[]>([]);
  const filled = code.every((c) => c !== '');

  const set = (i: number, v: string) => {
    const d = v.replace(/[^0-9]/g, '').slice(-1);
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <Screen padded>
      <PressableScale onPress={() => router.back()} style={styles.back} activeScale={0.9}>
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </PressableScale>
      <View style={styles.wrap}>
        <Mikan size={80} />
        <Text style={styles.title}>認証コードを入力</Text>
        <Text style={styles.sub}>demo@gungun.app に送信した{'\n'}6桁のコードを入力してください</Text>

        <View style={styles.codeRow}>
          {code.map((c, i) => (
            <TextInput
              key={i}
              ref={(r) => { refs.current[i] = r; }}
              value={c}
              onChangeText={(v) => set(i, v)}
              onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus(); }}
              keyboardType="number-pad"
              maxLength={1}
              style={[styles.box, shadows.soft, c ? styles.boxFilled : null]}
            />
          ))}
        </View>

        <Button title="認証する" disabled={!filled} onPress={() => router.replace('/(tabs)')} style={{ marginTop: spacing.xl }} />
        <View style={styles.resend}>
          <Text style={styles.resendText}>コードが届かない場合</Text>
          <PressableScale><Text style={styles.resendLink}>再送信（60秒）</Text></PressableScale>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 8, left: 8, zIndex: 10, padding: 6 },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, marginTop: spacing.lg },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },
  codeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing['2xl'] },
  box: { width: 48, height: 58, borderRadius: radius.md, backgroundColor: colors.card, textAlign: 'center', fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, borderWidth: 2, borderColor: 'transparent' },
  boxFilled: { borderColor: colors.green },
  resend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  resendText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  resendLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
});
