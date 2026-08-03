import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/theme';
import { AuthProvider } from '@/store/auth';
import { AuthGate } from '@/components/AuthGate';
import { TreeProvider } from '@/store/tree';
import { BlocksProvider } from '@/store/blocks';
import { LikesProvider } from '@/store/likes';
import { NotificationsProvider } from '@/store/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // 角丸ゴシック M PLUS Rounded 1c（使用文字だけにサブセット化）。
  // Ionicons.font はネイティブでは自動リンクされるが、Web では明示ロードが要る。
  const [loaded, fontError] = useFonts({
    MPLUSRounded1c_400Regular: require('../assets/fonts/MPLUSRounded1c-Regular.ttf'),
    MPLUSRounded1c_500Medium: require('../assets/fonts/MPLUSRounded1c-Medium.ttf'),
    MPLUSRounded1c_700Bold: require('../assets/fonts/MPLUSRounded1c-Bold.ttf'),
    MPLUSRounded1c_800ExtraBold: require('../assets/fonts/MPLUSRounded1c-ExtraBold.ttf'),
    ...Ionicons.font,
  });

  // フォントの取得に失敗しても画面は出す。
  // 1つでも読めないと `loaded` が永久に false になり、真っ白なページになるため
  // （Web ビルドでアイコンフォントが 404 になったときに実際に起きた）。
  const ready = loaded || Boolean(fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <TreeProvider>
            <BlocksProvider>
            <LikesProvider>
            <NotificationsProvider>
            <StatusBar style="dark" />
            <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="item/[id]" />
              <Stack.Screen name="plant/seed" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
              <Stack.Screen name="water/[id]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
              <Stack.Screen name="tree/[rootId]" />
              <Stack.Screen name="water/about" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
              <Stack.Screen name="item/edit/[id]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            </Stack>
            </AuthGate>
            </NotificationsProvider>
            </LikesProvider>
            </BlocksProvider>
          </TreeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
