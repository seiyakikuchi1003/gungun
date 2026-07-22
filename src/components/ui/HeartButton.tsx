import React, { useState } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '@/theme';
import { like } from '@/lib/haptics';

/** いいねボタン（タップでハートがポップするマイクロインタラクション）。 */
export function HeartButton({ count, initial = false, size = 18 }: { count: number; initial?: boolean; size?: number }) {
  const [liked, setLiked] = useState(initial);
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 1 + burst.value * 0.8 }],
  }));

  const toggle = () => {
    const next = !liked;
    setLiked(next);
    if (next) like(); // インスタ風：いいねの瞬間にしっかりした振動
    scale.value = withSequence(withSpring(next ? 1.4 : 0.85, { damping: 6, stiffness: 300 }), withSpring(1, { damping: 10 }));
    if (next) {
      burst.value = 0;
      burst.value = withSequence(withTiming(0.6, { duration: 120 }), withTiming(0, { duration: 260 }));
    }
  };

  return (
    <Pressable onPress={toggle} hitSlop={8} style={styles.row}>
      <Animated.View>
        <Animated.View style={[styles.burst, burstStyle]} pointerEvents="none">
          <Ionicons name="heart" size={size + 10} color={colors.heart} />
        </Animated.View>
        <Animated.View style={heartStyle}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={size} color={liked ? colors.heart : colors.textSecondary} />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.count, liked && { color: colors.heart }]}>{count + (liked ? 1 : 0)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  burst: { position: 'absolute', top: -5, left: -5, opacity: 0 },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
