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
      <Tabs.Screen name="mypage" />
    </Tabs>
  );
}
