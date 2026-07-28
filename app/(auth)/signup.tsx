import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';
import { LeafDecor } from '@/components/art/LeafDecor';
import { colors, spacing, fonts } from '@/theme';
import { useAuth } from '@/store/auth';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [agree, setAgree] = useState(false);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (busy) return;
    if (!nickname.trim()) { setError('ニックネームを入力してください'); return; }
    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    if (password.length < 8) { setError('パスワードは8文字以上にしてください'); return; }

    setError(null);
    setBusy(true);
    const res = await signUp(email, password, nickname);
    setBusy(false);
    if (res.error) { setError(res.error); return; }

    // メール確認が有効なプロジェクトでは、コード入力画面を挟む
    if (res.needsVerification) {
      router.replace({ pathname: '/(auth)/verify', params: { email: email.trim() } });
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <Screen scroll>
      <View style={styles.leafLeft} pointerEvents="none">
        <LeafDecor width={170} height={230} opacity={0.5} />
      </View>
      <View style={styles.leafRight} pointerEvents="none">
        <LeafDecor width={170} height={230} flip opacity={0.5} />
      </View>

      <PressableScale onPress={() => router.back()} style={styles.back} activeScale={0.9}>
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </PressableScale>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
            <Mikan size={96} />
            <Text style={styles.title}>新規登録</Text>
            <Text style={styles.subtitle}>ぐんぐんをはじめましょう</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.form}>
            <FormError message={error} />
            <TextField
              leftIcon="person"
              placeholder="ニックネーム"
              maxLength={20}
              value={nickname}
              onChangeText={(t) => { setNickname(t); setError(null); }}
            />
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
            <TextField
              leftIcon="lock-closed"
              placeholder="パスワード（8文字以上）"
              password
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
            />

            <Pressable style={styles.agreeRow} onPress={() => setAgree((a) => !a)}>
              <View style={[styles.checkbox, agree && styles.checkboxOn]}>
                {agree && <Ionicons name="checkmark" size={18} color={colors.white} />}
              </View>
              <Text style={styles.agreeText}>
                <Text style={styles.link}>利用規約</Text>と
                <Text style={styles.link}>プライバシーポリシー</Text>に同意する
              </Text>
            </Pressable>

            <Button
              title="登録する"
              disabled={!agree}
              loading={busy}
              onPress={onSubmit}
              style={{ marginTop: spacing.sm }}
            />
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>すでにアカウントをお持ちの方</Text>
            <PressableScale onPress={() => router.back()}>
              <Text style={styles.footerLink}>ログイン</Text>
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 8, left: 16, zIndex: 10, padding: 6 },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  title: { fontFamily: fonts.black, fontSize: 40, color: colors.green, marginTop: 8, letterSpacing: 4 },
  subtitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, marginTop: 6 },
  form: { gap: spacing.lg },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, paddingHorizontal: 4 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: colors.green, borderColor: colors.green },
  agreeText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.textPrimary, lineHeight: 22 },
  link: { color: colors.green, fontFamily: fonts.bold },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: 28 },
  footerText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary },
  footerLink: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  leafLeft: { position: 'absolute', left: -28, bottom: -16 },
  leafRight: { position: 'absolute', right: -28, bottom: -16 },
});
