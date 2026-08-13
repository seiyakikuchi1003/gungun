import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, shadows } from '@/theme';
import { useExchanges, type UITrade } from '@/hooks/useExchanges';
import { PressableScale } from './PressableScale';
import { Mikan } from '@/components/art/Mikan';

type TabMeta = { label: string; icon: keyof typeof Ionicons.glyphMap };

const META: Record<string, TabMeta> = {
  index: { label: 'ホーム', icon: 'home' },
  board: { label: '掲示板', icon: 'chatbubble-ellipses' },
  harvest: { label: '収穫', icon: 'leaf' },
  premium: { label: 'プレミアム', icon: 'diamond' },
  exchange: { label: '取引', icon: 'swap-horizontal' },
  mypage: { label: 'マイページ', icon: 'person' },
};

// expo-router の Tabs tabBar が渡す props のうち、本コンポーネントで使う分だけを型付け。
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/**
 * ボトムナビ。中央の「収穫」はオレンジの円形＋みかんマスコットが一段浮き出た形。
 */
/**
 * ナビには出さない画面。ルート自体は残す（ホーム右上などから開く）。
 * マイページは使用頻度が低く、取引を常時見える位置に置くため外した（2026-08-13）。
 */
const HIDDEN = new Set(['mypage']);

export function BottomNav({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { list } = useExchanges();
  // 自分の対応待ち（発送すべき／受け取れる）があるか
  const activeTrades = list.filter(
    (t: UITrade) => (t.dir === 'send' && t.status === 'pending') || (t.dir === 'receive' && t.status === 'shipped')
  ).length;
  const shown = state.routes.filter((r) => !HIDDEN.has(r.name));
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }, shadows.sheet]}>
      {shown.map((route) => {
        const index = state.routes.indexOf(route);
        const focused = state.index === index;
        const meta = META[route.name] ?? { label: route.name, icon: 'ellipse' };
        const isCenter = route.name === 'harvest';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (isCenter) {
          return (
            <PressableScale key={route.key} onPress={onPress} activeScale={0.9} style={styles.centerTab}>
              <View style={[styles.centerCircle, shadows.button]}>
                <Mikan size={44} />
              </View>
              <Text style={[styles.label, styles.centerLabel, focused && styles.labelActiveOrange]}>
                {meta.label}
              </Text>
            </PressableScale>
          );
        }

        return (
          <PressableScale key={route.key} onPress={onPress} activeScale={0.9} style={styles.tab}>
            <View>
              <Ionicons
                name={focused ? meta.icon : (`${meta.icon}-outline` as keyof typeof Ionicons.glyphMap)}
                size={24}
                color={focused ? colors.green : colors.textSecondary}
              />
              {/* 進行中の取引があれば赤ポチ。見ていないタブの用事に気づけるように（2026-08-12 指摘） */}
              {route.name === 'exchange' && activeTrades > 0 && <View style={styles.dot} />}
            </View>
            <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 4 },
  dot: {
    position: 'absolute', top: -1, right: -3, width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#E5484D', borderWidth: 1.5, borderColor: colors.card,
  },
  label: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary },
  labelActive: { color: colors.green, fontFamily: fonts.bold },
  labelActiveOrange: { color: colors.orangeDeep, fontFamily: fonts.bold },
  centerTab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  centerCircle: {
    position: 'absolute',
    top: -34,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.orangeSoft,
    borderWidth: 4,
    borderColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: { marginTop: 36 },
});
