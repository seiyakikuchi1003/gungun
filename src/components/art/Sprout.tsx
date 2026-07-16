import React from 'react';
import Svg, { Path, G, Ellipse } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  size?: number;
  color?: string;
  /** 土台（ポット/地面）を描くか */
  base?: boolean;
};

/**
 * 双葉スプラウト（🌱）。ロゴ横・ボタン内・タネを植えるヘッダーで使用。
 */
export function Sprout({ size = 28, color = colors.mikanLeaf, base = false }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {base && <Ellipse cx="32" cy="54" rx="18" ry="5" fill="#D9CBB0" />}
      {/* 茎 */}
      <Path
        d="M32 54 C32 44 32 34 32 26"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
      {/* 左の葉 */}
      <G>
        <Path
          d="M32 32 C22 32 12 26 8 16 C20 12 31 18 33 30 Z"
          fill={color}
        />
        {/* 右の葉 */}
        <Path
          d="M32 30 C42 28 52 20 55 10 C43 8 33 15 32 28 Z"
          fill={color}
          opacity={0.92}
        />
      </G>
    </Svg>
  );
}
