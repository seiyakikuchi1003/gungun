import React, { useState } from 'react';
// アバターは RN の Image を使用（expo-image は number ソースの一部で web クラッシュするため）
import { Image, View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '@/theme';

type Props = { uri?: string | number; name?: string; size?: number };

/** 丸いユーザーアイコン。uri は URL(string) でもローカル(require の number) でも可。無ければ頭文字。 */
export function Avatar({ uri, name, size = 44 }: Props) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const [broken, setBroken] = useState(false);

  // 空文字は「未設定」。以前は uri != null だけを見ていたため、アイコン未設定の人が
  // source={{uri:''}} になって真っ白な丸になっていた（2026-08-04 実機で発覚）。
  const hasImage = typeof uri === 'number' || (typeof uri === 'string' && uri.trim() !== '');

  if (hasImage && !broken) {
    const source = typeof uri === 'number' ? uri : { uri: uri as string };
    return (
      <Image
        source={source}
        style={[dim, styles.img]}
        resizeMode="cover"
        // URL が切れていても頭文字にフォールバックする
        onError={() => setBroken(true)}
      />
    );
  }

  // 未設定のときは頭文字。名前も無いときは人のアイコン（「?」より収まりが良い）
  const initial = name?.trim() ? [...name.trim()][0] : null;
  return (
    <View style={[dim, styles.fallback]}>
      {initial ? (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color={colors.green} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.cardMuted },
  fallback: { backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  initial: { fontFamily: fonts.bold, color: colors.green },
});
