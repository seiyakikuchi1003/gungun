import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';
import { useAuth } from '@/store/auth';
import { lh } from '@/lib/fontScale';

/**
 * パスワード再設定。
 *
 *  1. メールアドレスを入れて再設定コードを送る
 *  2. verify 画面で6桁コードを確認（＝一時的にログイン状態になる）
 *  3. ここに step=password で戻ってきて、新しいパスワードを決める
 */
export default function Reset() {
  const { sendResetCode, updatePassword, signOut } = useAuth();
  const params = useLocalSearchParams<{ step?: string }>();
  const step = params.step === 'password' ? 'password' : 'email';

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSend = async () => {
    if (busy) return;
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    setError(null);
    setBusy(true);
    const res = await sendResetCode(email);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    router.push({ pathname: '/(auth)/verify', params: { email: email.trim(), purpose: 'recovery' } });
  };

  const onUpdate = async () => {
    if (busy) return;
    if (pw.length < 8) { setError('パスワードは8文字以上にしてください'); return; }
    setError(null);
    setBusy(true);
    const res = await updatePassword(pw);
    if (res.error) { setBusy(false); setError(res.error); return; }
    // 新しいパスワードで入り直してもらう（他端末のセッションも整理される）
    await signOut();
    setBusy(false);
    router.replace('/(auth)/login');
  };

  return (
    <Screen padded>
      <PressableScale onPress={() => router.back()} style={styles.back} activeScale={0.9}>
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </PressableScale>
      <View style={styles.wrap}>
        <Mikan size={80} />
        <Text style={styles.title}>パスワード再設定</Text>
        <Text style={styles.sub}>
          {step === 'password'
            ? '新しいパスワードを入力してください'
            : '登録済みのメールアドレスに認証コードを送ります'}
        </Text>

        <View style={styles.form}>
          <FormError message={error} />
          {step === 'email' ? (
            <>
              <TextField
                leftIcon="mail"
                placeholder="メールアドレス"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
              />
              <Button title="認証コードを送信" loading={busy} onPress={onSend} style={{ marginTop: spacing.sm }} />
            </>
          ) : (
            <>
              <TextField
                leftIcon="lock-closed"
                placeholder="新しいパスワード（8文字以上）"
                password
                autoComplete="new-password"
                textContentType="newPassword"
                value={pw}
                onChangeText={(t) => { setPw(t); setError(null); }}
              />
              <Button title="パスワードを変更" loading={busy} onPress={onUpdate} style={{ marginTop: spacing.sm }} />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 8, left: 8, zIndex: 10, padding: 6 },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, marginTop: spacing.lg },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: lh(21), paddingHorizontal: 20 },
  form: { alignSelf: 'stretch', gap: spacing.lg, marginTop: spacing['2xl'] },
});
