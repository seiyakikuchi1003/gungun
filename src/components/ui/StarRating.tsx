import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '@/theme';

type Props = {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  gap?: number;
};

/** 星5つ評価（表示・入力両対応）。onChange を渡すと入力可。 */
export function StarRating({ value, onChange, size = 24, gap = 4 }: Props) {
  return (
    <View style={[styles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = (
          <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? colors.orange : colors.border} />
        );
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={4}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' } });
