import React from 'react';
// アバターは RN の Image を使用（expo-image は number ソースの一部で web クラッシュするため）
import { Image, View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = { uri?: string | number; name?: string; size?: number };

/** 丸いユーザーアイコン。uri は URL(string) でもローカル(require の number) でも可。無ければ頭文字。 */
export function Avatar({ uri, name, size = 44 }: Props) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (uri != null) {
    const source = typeof uri === 'number' ? uri : { uri };
    return <Image source={source} style={[dim, styles.img]} resizeMode="cover" />;
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
