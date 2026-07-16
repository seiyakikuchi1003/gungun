import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Mikan } from '@/components/art/Mikan';

export default function Reset() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  return (
    <Screen padded>
      <PressableScale onPress={() => router.back()} style={styles.back} activeScale={0.9}>
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </PressableScale>
      <View style={styles.wrap}>
        <Mikan size={80} />
        <Text style={styles.title}>パスワード再設定</Text>
        <Text style={styles.sub}>
          {sent ? '届いたコードと新しいパスワードを入力してください' : '登録済みのメールアドレスに認証コードを送ります'}
        </Text>

        <View style={styles.form}>
          {!sent ? (
            <>
              <TextField leftIcon="mail" placeholder="メールアドレス" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <Button title="認証コードを送信" onPress={() => setSent(true)} style={{ marginTop: spacing.sm }} />
            </>
          ) : (
            <>
              <TextField leftIcon="keypad" placeholder="認証コード（6桁）" keyboardType="number-pad" />
              <TextField leftIcon="lock-closed" placeholder="新しいパスワード（8文字以上）" password value={pw} onChangeText={setPw} />
              <Button title="パスワードを変更" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: spacing.sm }} />
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
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21, paddingHorizontal: 20 },
  form: { alignSelf: 'stretch', gap: spacing.lg, marginTop: spacing['2xl'] },
});
