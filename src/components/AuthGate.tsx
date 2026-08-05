import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { colors } from '@/theme';
import { useAuth } from '@/store/auth';

/**
 * ログイン状態に応じて行き先を振り分ける。
 *
 *  - 未ログインなのにアプリ内にいる → ログイン画面へ
 *  - ログイン済みなのに認証画面にいる → ホームへ
 *
 * セッション復元が終わるまで（ready=false）は画面を出さない。
 * 一瞬ログイン画面が見えてからホームに飛ぶ、というチラつきを防ぐため。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authed } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';
  // パスワードの再設定はログイン中の人も開く（マイページ →「パスワードを変更する」）。
  // ここを弾いていたため、押すとホームに飛ばされていた（2026-08-05 指摘）
  const allowedWhileSignedIn = segments[1] === 'reset';

  useEffect(() => {
    if (!ready) return;
    if (!authed && !inAuthGroup) router.replace('/(auth)/login');
    else if (authed && inAuthGroup && !allowedWhileSignedIn) router.replace('/(tabs)');
  }, [ready, authed, inAuthGroup, allowedWhileSignedIn, router]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
