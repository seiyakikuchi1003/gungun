import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { GunGunLogo } from '@/components/art/GunGunLogo';
import { LeafDecor } from '@/components/art/LeafDecor';
import { Sprout } from '@/components/art/Sprout';
import { colors, spacing, fonts } from '@/theme';
import { useAuth } from '@/store/auth';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('demo@gungun.app');
  const [password, setPassword] = useState('password123');

  return (
    <Screen>
      {/* 背景装飾の葉（下隅） */}
      <View style={styles.leafLeft} pointerEvents="none">
        <LeafDecor width={190} height={260} />
      </View>
      <View style={styles.leafRight} pointerEvents="none">
        <LeafDecor width={190} height={260} flip />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
            <GunGunLogo size={46} />
            <Text style={styles.tagline}>いらないものが、ほしいものに。</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.form}>
            <TextField
              leftIcon="mail"
              placeholder="メールアドレス"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              leftIcon="lock-closed"
              placeholder="パスワード"
              password
              value={password}
              onChangeText={setPassword}
            />
            <Button
              title="ログイン"
              leftIcon={<Sprout size={22} color={colors.white} />}
              onPress={() => {
                signIn();
                router.replace('/(tabs)');
              }}
              style={{ marginTop: spacing.sm }}
            />
            <PressableScale onPress={() => router.push('/(auth)/reset')} style={styles.forgot}>
              <Text style={styles.forgotText}>パスワードをお忘れの方</Text>
            </PressableScale>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(320).duration(500)} style={styles.footer}>
            <Text style={styles.footerText}>アカウントをお持ちでない方</Text>
            <View style={styles.divider} />
            <PressableScale onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}>新規登録</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 44 },
  tagline: {
    marginTop: 18,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  form: { gap: spacing.lg },
  forgot: { alignSelf: 'center', marginTop: spacing.lg },
  forgotText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  footerText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary },
  divider: { width: 1, height: 16, backgroundColor: colors.border },
  footerLink: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  leafLeft: { position: 'absolute', left: -30, bottom: -20 },
  leafRight: { position: 'absolute', right: -30, bottom: -20 },
});
