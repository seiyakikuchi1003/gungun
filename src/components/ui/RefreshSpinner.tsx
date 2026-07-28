import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * X（旧Twitter）風の引っ張って更新スピナー。
 * 引っ張った量に合わせて回転しながら現れ、離すとクルクル回り続け、
 * 更新が終わるとすっと消える。ネイティブの RefreshControl
 * （tintColor: 'transparent'）と重ねて使う。
 */

const SIZE = 28;
const STROKE = 2.5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const PULL_MAX = 80; // この引っ張り量でフル表示

type Props = {
  pullY: SharedValue<number>; // ScrollView の contentOffset.y（引っ張りで負になる）
  refreshing: boolean;
  topOffset?: number;
};

export function RefreshSpinner({ pullY, refreshing, topOffset = 0 }: Props) {
  const spin = useSharedValue(0); // 更新中の連続回転（deg）
  const hold = useSharedValue(0); // 更新中は1：引っ張り量に関係なく表示を維持

  useEffect(() => {
    if (refreshing) {
      hold.value = withTiming(1, { duration: 120 });
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 700, easing: Easing.linear }), -1);
    } else {
      hold.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) });
      cancelAnimation(spin);
    }
  }, [refreshing]);

  const style = useAnimatedStyle(() => {
    const pull = interpolate(-pullY.value, [0, PULL_MAX], [0, 1], Extrapolation.CLAMP);
    const p = Math.max(pull, hold.value);
    return {
      opacity: p,
      transform: [
        { translateY: interpolate(p, [0, 1], [-14, 12]) },
        { scale: interpolate(p, [0, 1], [0.5, 1]) },
        // 引っ張りで手回し → 離したら連続回転
        { rotate: `${pull * 200 + spin.value}deg` },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: topOffset }]}>
      <Animated.View style={style}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.green}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C * 0.72} ${C}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
});
