import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Mikan } from '@/components/art/Mikan';

type Props = {
  /** リモート画像URL */
  uri?: string;
  /** ローカル画像（require の戻り値など）。指定時は uri より優先。 */
  source?: number | ImageSource;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** プレースホルダーのマスコットサイズ */
  markSize?: number;
};

/**
 * 商品画像サムネイル。
 * 画像読込前／失敗時はブランドカラーのグラデ＋みかん透かしを表示するので、
 * 空白にならず「意図されたプレースホルダー」に見える。実写真が用意されれば上に載る。
 */
export function Thumb({ uri, source, style, radius = 0, markSize = 44 }: Props) {
  const imgSource = source ?? (uri ? { uri } : undefined);
  return (
    <View style={[styles.wrap, { borderRadius: radius }, style]}>
      <LinearGradient
        colors={['#FBEBD3', '#F3E4CB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.mark}>
        <View style={{ opacity: 0.18 }}>
          <Mikan size={markSize} face={false} />
        </View>
      </View>
      {imgSource ? (
        <Image source={imgSource} style={styles.img} contentFit="cover" transition={250} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#F3E4CB' },
  mark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  img: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

/** width/height を持つ簡易サイズ指定用 */
export type ThumbSize = { width: DimensionValue; height: DimensionValue };
