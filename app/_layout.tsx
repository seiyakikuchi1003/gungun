import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { colors } from '@/theme';
import { AuthProvider } from '@/store/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // 使用文字だけにサブセット化したローカルフォント（1ウェイト約360KB）。
  const [loaded] = useFonts({
    NotoSansJP_400Regular: require('../assets/fonts/NotoSansJP-Regular.ttf'),
    NotoSansJP_500Medium: require('../assets/fonts/NotoSansJP-Medium.ttf'),
    NotoSansJP_700Bold: require('../assets/fonts/NotoSansJP-Bold.ttf'),
    NotoSansJP_900Black: require('../assets/fonts/NotoSansJP-Black.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
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
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
