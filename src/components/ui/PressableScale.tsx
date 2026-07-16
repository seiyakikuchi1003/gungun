import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** 押下時の縮小率 */
  activeScale?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * 押すとふわっと縮むボタン土台。全タップ要素の触感を統一する。
 */
export function PressableScale({ activeScale = 0.96, style, children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        scale.value = withSpring(activeScale, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(0.9, { duration: 90 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 260 });
        opacity.value = withTiming(1, { duration: 120 });
        rest.onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
