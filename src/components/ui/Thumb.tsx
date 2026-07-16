import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Mikan } from '@/components/art/Mikan';
import { colors } from '@/theme';

type Props = {
  uri?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** プレースホルダーのマスコットサイズ */
  markSize?: number;
};

/**
 * 商品画像サムネイル。
 * 画像読込前／失敗時はブランドカラーのグラデ＋みかん透かしを表示するので、
 * 空白にならず「意図されたプレースホルダー」に見える。実機では実写真が上に載る。
 */
export function Thumb({ uri, style, radius = 0, markSize = 44 }: Props) {
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
      {uri ? (
        <Image source={{ uri }} style={styles.img} contentFit="cover" transition={250} />
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
