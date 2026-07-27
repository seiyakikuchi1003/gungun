import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fonts, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { medium } from '@/lib/haptics';

const SIZE = 56; // 丸に畳んだときの直径

type Props = {
  /** 一覧のスクロール位置。下に読むと畳む */
  scrollY: SharedValue<number>;
  onPress: () => void;
  label: string;
  icon: React.ReactNode;
  /** ラベル分の追加幅（文字数に合わせて指定） */
  labelWidth?: number;
  bottom?: number;
};

/**
 * スクロールに追従する拡張FAB。
 *
 * 一覧を読んでいる間は丸く畳んでコンテンツを隠さず、
 * 上に戻る／最上部ではラベル付きに開いて何のボタンか分かるようにする。
 * ホームの「タネを植える」・掲示板の「投稿」で共通利用する。
 */
export function ExpandableFab({ scrollY, onPress, label, icon, labelWidth = 118, bottom = 26 }: Props) {
  const open = useSharedValue(1);

  useAnimatedReaction(
    () => scrollY.value,
    (cur, prev) => {
      if (prev === null) return;
      const dy = cur - prev;
      if (cur < 40) {
        open.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
      } else if (dy > 2) {
        open.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }); // 下に読む→畳む
      } else if (dy < -2) {
        open.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }); // 上に戻る→開く
      }
    }
  );

  // 幅は外側のビューでアニメーションさせる（グラデーション側に当てると効かない）
  const wrap = useAnimatedStyle(() => ({ width: SIZE + open.value * labelWidth }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: open.value }));

  return (
    <Animated.View style={[styles.wrap, { bottom }, wrap]}>
      <PressableScale
        onPress={() => { medium(); onPress(); }}
        accessibilityLabel={label}
        activeScale={0.95}
        style={styles.press}
      >
        <LinearGradient
          colors={[colors.green, colors.greenDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fab, shadows.button]}
        >
          <View style={styles.icon}>{icon}</View>
          <Animated.Text numberOfLines={1} style={[styles.text, labelStyle]}>
            {label}
          </Animated.Text>
        </LinearGradient>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 20, height: SIZE },
  press: { flex: 1 },
  fab: {
    flex: 1,
    borderRadius: SIZE / 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  icon: { width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' },
  text: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.3,
    marginRight: 20,
  },
});
