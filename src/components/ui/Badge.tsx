import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, fonts } from '@/theme';

type Tone = 'green' | 'orange' | 'gray' | 'premium';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.greenSoft, fg: colors.green },
  orange: { bg: colors.orangeSoft, fg: colors.orangeDeep },
  gray: { bg: '#EFECE4', fg: colors.statusCompleted },
  premium: { bg: '#F7EAC9', fg: colors.premium },
};

export function Badge({ label, tone = 'green' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.2 },
});
