import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  width?: number;
  height?: number;
  flip?: boolean;
  opacity?: number;
};

/**
 * 背景装飾の葉の枝（ログイン/新規登録の下隅の水彩っぽい葉）。
 * 単色ベクターで淡く再現。flip で左右反転。
 */
export function LeafDecor({ width = 180, height = 240, flip = false, opacity = 0.55 }: Props) {
  const leaf = (cx: number, cy: number, r: number, rot: number, c: string) => (
    <Path
      d={`M${cx} ${cy} C${cx - r} ${cy - r * 0.5} ${cx - r} ${cy - r * 1.6} ${cx} ${cy - r * 2} C${cx + r} ${cy - r * 1.6} ${cx + r} ${cy - r * 0.5} ${cx} ${cy} Z`}
      fill={c}
      transform={`rotate(${rot} ${cx} ${cy})`}
    />
  );
  return (
    <Svg width={width} height={height} viewBox="0 0 180 240" opacity={opacity}>
      <G transform={flip ? 'scale(-1,1) translate(-180,0)' : undefined}>
        {/* 主枝 */}
        <Path
          d="M20 240 C40 190 60 150 70 90"
          stroke={colors.leafDecor}
          strokeWidth={3}
          fill="none"
        />
        <Path
          d="M60 230 C90 185 110 140 118 70"
          stroke={colors.leafDecor}
          strokeWidth={3}
          fill="none"
        />
        {leaf(30, 210, 16, -40, '#CFE0AF')}
        {leaf(42, 185, 18, -30, '#C4DBA0')}
        {leaf(54, 158, 18, -25, '#D3E3B6')}
        {leaf(64, 128, 16, -18, '#C9DEA8')}
        {leaf(70, 98, 14, -10, '#D6E6BB')}
        {leaf(90, 205, 15, 20, '#CFE0AF')}
        {leaf(102, 175, 17, 22, '#C4DBA0')}
        {leaf(112, 142, 16, 24, '#D3E3B6')}
        {leaf(118, 108, 14, 20, '#C9DEA8')}
        {leaf(122, 80, 12, 15, '#D6E6BB')}
      </G>
    </Svg>
  );
}
