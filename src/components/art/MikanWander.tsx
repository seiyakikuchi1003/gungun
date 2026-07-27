import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Mikan } from './Mikan';

type Props = {
  size?: number;
  /** 左右にうろつく幅（px） */
  range?: number;
  /** 1往復にかける時間（ms）。大きいほどゆっくり */
  duration?: number;
  /** 開始のずらし（複数置くときに動きを揃えないため） */
  delay?: number;
};

/**
 * うろうろするみかんマスコット。
 *
 * ・左右にゆっくり往復しながら、ぴょこぴょこ跳ねる
 * ・進行方向を向くように左右反転する
 * ・跳ねるタイミングで少しだけ潰れる（スカッシュ）
 *
 * 位置は親側で決める（absolute配置など）。ここでは「その場でのうろつき」だけを担当する。
 */
export function MikanWander({ size = 44, range = 14, duration = 3200, delay = 0 }: Props) {
  const x = useSharedValue(0);
  const hop = useSharedValue(0);
  const dir = useSharedValue(1); // 1 = 右向き / -1 = 左向き

  useEffect(() => {
    // 左右への往復（端でほんの少し止まる）
    x.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.quad) })
        ),
        -1
      )
    );
    // 向き（往路は右、復路は左）
    dir.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: duration / 2 }),
          withTiming(-1, { duration: duration / 2 })
        ),
        -1
      )
    );
    // ぴょこぴょこ跳ねる（往復より短い周期）
    hop.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 260 }) // 少し休む
        ),
        -1
      )
    );
  }, [duration, delay]);

  const style = useAnimatedStyle(() => {
    const t = x.value;
    const hopY = -hop.value * (size * 0.16);
    // 着地の瞬間だけほんの少し潰す
    const squash = 1 - (1 - hop.value) * 0.04;
    return {
      transform: [
        { translateX: (t - 0.5) * range * 2 },
        { translateY: hopY },
        { scaleX: dir.value >= 0 ? 1 : -1 },
        { scaleY: squash },
      ],
    };
  });

  return (
    <Animated.View style={style} pointerEvents="none">
      <Mikan size={size} />
    </Animated.View>
  );
}
