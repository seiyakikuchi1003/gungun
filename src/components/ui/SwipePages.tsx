import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

/**
 * 横にはらってタブを切り替える枠（2026-08-17 指摘）。
 *
 * これまでも左右スワイプで切り替わってはいたが、中身が一瞬で差し替わるだけで、
 * 「切り替わった」という手応えが無く、操作が効いたのか分かりにくかった。
 *
 * 切り替わるときに、進む向きへ少しずらしながら薄くする。
 * 派手に動かすと毎回の切り替えがうるさいので、120ms・24px だけにとどめる。
 *
 * 位置を指に追従させる本格的なページャにはしていない。
 * 中の縦スクロールと競合してスクロールが取られるのを避けるため、
 * 判定は Fling（はらう動き）のままにしてある。
 */
export function SwipePages({ index, count, onChange, children }: {
  /** 今表示しているページ（0始まり） */
  index: number;
  count: number;
  onChange: (next: number) => void;
  children: React.ReactNode;
}) {
  const shift = useSharedValue(0);
  const fade = useSharedValue(1);

  // ページが変わったら、入ってくる向きから滑り込ませる
  useEffect(() => {
    fade.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
    shift.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
  }, [index, fade, shift]);

  const go = (next: number, dir: -1 | 1) => {
    if (next < 0 || next >= count) return;
    // 出ていく側を先に動かしてから中身を差し替える
    shift.value = withTiming(-24 * dir, { duration: 110 });
    fade.value = withTiming(0.35, { duration: 110 });
    shift.value = 24 * dir;
    onChange(next);
  };

  const gesture = Gesture.Race(
    Gesture.Fling().direction(Directions.LEFT).onEnd(() => go(index + 1, 1)).runOnJS(true),
    Gesture.Fling().direction(Directions.RIGHT).onEnd(() => go(index - 1, -1)).runOnJS(true)
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }],
    opacity: fade.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.root}>
        <Animated.View style={[styles.root, style]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
