import React, { useEffect } from 'react';
import { Pressable, PressableProps, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { tap } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** 押下時の縮小率 */
  activeScale?: number;
  /** 押下時の軽い振動（既定OFF。特別に効かせたいボタンだけtrueに） */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * 押すとふわっと縮むボタン土台。全タップ要素の触感を統一する。
 * バイブは既定OFF（成功時などの決め所は各画面側で success() を呼ぶ）。
 */
export function PressableScale({ activeScale = 0.96, haptic = false, style, children, ...rest }: Props) {
  // 呼び出し側が style で opacity を指定している（＝無効状態を薄く見せたい）場合、
  // ここのアニメーションで上書きしてしまわないよう、それを基準の濃さとして扱う。
  const styleOpacity = (StyleSheet.flatten(style) as ViewStyle | undefined)?.opacity;
  const restOpacity = typeof styleOpacity === 'number' ? styleOpacity : 1;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(restOpacity);

  useEffect(() => {
    opacity.value = withTiming(restOpacity, { duration: 120 });
  }, [restOpacity, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        if (haptic) tap();
        scale.value = withSpring(activeScale, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(restOpacity * 0.9, { duration: 90 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 260 });
        opacity.value = withTiming(restOpacity, { duration: 120 });
        rest.onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
