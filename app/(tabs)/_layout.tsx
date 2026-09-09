import { Tabs, Redirect } from 'expo-router';
import { BottomNav } from '@/components/ui/BottomNav';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { authed } = useAuth();
  if (!authed) return <Redirect href="/(auth)/login" />;
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="board" />
      <Tabs.Screen name="harvest" />
      <Tabs.Screen name="premium" />
      {/* 下のタブの右端はマイページ、取引はホーム右上のアイコンから開く。
          2026-08-13 に逆の並びにしていたが、2026-09-09 の会議で
          「取引が右上・マイページが右下」で結論と確認が取れた */}
      <Tabs.Screen name="mypage" />
      <Tabs.Screen name="exchange" options={{ href: null }} />
    </Tabs>
  );
}
