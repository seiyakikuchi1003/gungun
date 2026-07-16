import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors } from '@/theme';

type Props = { size?: number };

/**
 * じょうろマスコット（水やり確認モーダルの主役）。
 * 画像：ライトグリーンの本体に笑顔、注ぎ口から水しぶき。
 */
export function WateringCan({ size = 120 }: Props) {
  const green = '#8FCB5A';
  return (
    <Svg width={size} height={size} viewBox="0 0 160 140">
      {/* 水しぶき */}
      <G fill="#5FB6E8">
        <Path d="M20 40 C14 46 14 54 20 58 C26 54 26 46 20 40 Z" />
        <Path d="M34 30 C29 35 29 42 34 46 C39 42 39 35 34 30 Z" opacity={0.9} />
        <Circle cx="14" cy="70" r="4" />
      </G>
      {/* ハンドル */}
      <Path
        d="M96 44 C118 34 138 44 132 70"
        stroke={green}
        strokeWidth={11}
        strokeLinecap="round"
        fill="none"
      />
      {/* 注ぎ口 */}
      <Path d="M60 60 L20 44 L18 58 L58 78 Z" fill={green} />
      {/* 本体 */}
      <Path
        d="M60 52 L128 52 C132 52 134 56 133 60 L124 108 C123 116 116 122 108 122 L80 122 C72 122 65 116 64 108 L55 60 C54 56 56 52 60 52 Z"
        fill={green}
      />
      {/* 顔 */}
      <G>
        <Circle cx="84" cy="82" r="5" fill="#FFFFFF" />
        <Circle cx="108" cy="82" r="5" fill="#FFFFFF" />
        <Path
          d="M82 96 C88 104 104 104 110 96"
          stroke="#FFFFFF"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    </Svg>
  );
}
