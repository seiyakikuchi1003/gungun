import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { colors } from '@/theme';
import { useAuth } from '@/store/auth';
import { SuspendedScreen } from '@/components/feature/SuspendedScreen';

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
  const { ready, authed, profile, reloadProfile } = useAuth();
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

  // アプリを前面に戻したときにプロフィールを取り直す。
  // 使っている最中に運営が停止した場合も、次に開いた時点で停止の画面に切り替わる
  useEffect(() => {
    if (!authed) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') reloadProfile().catch(() => {});
    });
    return () => sub.remove();
  }, [authed, reloadProfile]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }
  // 利用停止中は、アプリの中身を一切出さない（2026-09-17 指摘）。
  // サーバ側でも書き込みは止めているが、画面が普通に使えるように見えると
  // 押すたびに失敗して、何が起きているのか本人に分からない
  if (authed && profile?.isSuspended && !inAuthGroup) {
    return <SuspendedScreen reason={profile.suspendedReason} />;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
