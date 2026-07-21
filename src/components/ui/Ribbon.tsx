import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = { label: 'NEW' | 'HOT' };

/**
 * カード左上の斜めコーナーリボン（メルカリ等でおなじみ）。
 * 親カードは overflow:'hidden' 前提。
 */
export function Ribbon({ label }: Props) {
  const bg = label === 'HOT' ? colors.mikan : colors.waterBlue;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.ribbon, { backgroundColor: bg }]}>
        <Text style={styles.text}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, width: 62, height: 62, overflow: 'hidden' },
  ribbon: {
    position: 'absolute',
    top: 12,
    left: -20,
    width: 84,
    alignItems: 'center',
    paddingVertical: 2.5,
    transform: [{ rotate: '-45deg' }],
  },
  text: { fontFamily: fonts.black, fontSize: 10, color: colors.white, letterSpacing: 0.5 },
});
