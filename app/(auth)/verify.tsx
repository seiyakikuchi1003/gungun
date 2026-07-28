import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';
import { useAuth } from '@/store/auth';

const RESEND_SEC = 60;

/**
 * メールに届いた6桁コードの確認画面。
 *
 * 新規登録（purpose=signup）とパスワード再設定（purpose=recovery）の
 * 両方で使う。確認が通ると signup はホームへ、recovery は新パスワード入力へ進む。
 */
export default function Verify() {
  const { verifyCode, resendCode } = useAuth();
  const params = useLocalSearchParams<{ email?: string; purpose?: string }>();
  const email = params.email ?? '';
  const purpose = params.purpose === 'recovery' ? 'recovery' : 'signup';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(RESEND_SEC);
  const refs = useRef<(TextInput | null)[]>([]);
  const filled = code.every((c) => c !== '');

  // 再送信できるようになるまでのカウントダウン
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const set = (i: number, v: string) => {
    setError(null);
    // ペースト対応：6桁まとめて入ったら全部の枠に配る
    const digits = v.replace(/[^0-9]/g, '');
    if (digits.length > 1) {
      const next = [...code];
      for (let k = 0; k < 6 - i; k++) next[i + k] = digits[k] ?? '';
      setCode(next);
      refs.current[Math.min(i + digits.length, 5)]?.focus();
      return;
    }
    const d = digits.slice(-1);
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const onVerify = async () => {
    if (busy || !filled) return;
    setError(null);
    setBusy(true);
    const res = await verifyCode(email, code.join(''), purpose);
    setBusy(false);
    if (res.error) { setError(res.error); return; }

    if (purpose === 'recovery') {
      // 本人確認が済んだので、新しいパスワードを決めてもらう
      router.replace({ pathname: '/(auth)/reset', params: { step: 'password' } });
    } else {
      router.replace('/(tabs)');
    }
  };

  const onResend = async () => {
    if (left > 0 || busy) return;
    setError(null);
    const res = await resendCode(email);
    if (res.error) { setError(res.error); return; }
    setLeft(RESEND_SEC);
  };

  return (
    <Screen padded>
      <PressableScale onPress={() => router.back()} style={styles.back} activeScale={0.9}>
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </PressableScale>
      <View style={styles.wrap}>
        <Mikan size={80} />
        <Text style={styles.title}>認証コードを入力</Text>
        <Text style={styles.sub}>
          {email || 'ご登録のメールアドレス'} に送信した{'\n'}6桁のコードを入力してください
        </Text>

        <View style={styles.errorSlot}>
          <FormError message={error} />
        </View>

        <View style={styles.codeRow}>
          {code.map((c, i) => (
            <TextInput
              key={i}
              ref={(r) => { refs.current[i] = r; }}
              value={c}
              onChangeText={(v) => set(i, v)}
              onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus(); }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              editable={!busy}
              style={[styles.box, shadows.soft, c ? styles.boxFilled : null]}
            />
          ))}
        </View>

        <Button
          title="認証する"
          disabled={!filled}
          loading={busy}
          onPress={onVerify}
          style={{ marginTop: spacing.xl }}
        />
        <View style={styles.resend}>
          <Text style={styles.resendText}>コードが届かない場合</Text>
          <PressableScale onPress={onResend} disabled={left > 0}>
            <Text style={[styles.resendLink, left > 0 && styles.resendOff]}>
              {left > 0 ? `再送信（${left}秒）` : '再送信する'}
            </Text>
          </PressableScale>
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
  errorSlot: { alignSelf: 'stretch', marginTop: spacing.lg },
  codeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  box: { width: 48, height: 58, borderRadius: radius.md, backgroundColor: colors.card, textAlign: 'center', fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, borderWidth: 2, borderColor: 'transparent' },
  boxFilled: { borderColor: colors.green },
  resend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  resendText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  resendLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  resendOff: { color: colors.textPlaceholder },
});
