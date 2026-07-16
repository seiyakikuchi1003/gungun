import React from 'react';
import { Image } from 'expo-image';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = { uri?: string; name?: string; size?: number };

/** 丸いユーザーアイコン。画像が無ければ頭文字を表示。 */
export function Avatar({ uri, name, size = 44 }: Props) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[dim, styles.img]} contentFit="cover" transition={200} />;
  }
  return (
    <View style={[dim, styles.fallback]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {name ? name.slice(0, 1) : '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.cardMuted },
  fallback: { backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  initial: { fontFamily: fonts.bold, color: colors.green },
});
