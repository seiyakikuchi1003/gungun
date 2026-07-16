import React from 'react';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  size?: number;
  /** 顔を表示するか（ロゴ横の小さいみかんは顔なしでも可） */
  face?: boolean;
};

/**
 * みかんマスコット。
 * 提供画像（オレンジの楕円ボディ＋右上の葉＋白い目・スマイル・3つのそばかす）を再現。
 */
export function Mikan({ size = 96, face = true }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* 葉 */}
      <G>
        <Path
          d="M104 62 C112 30 150 12 178 18 C182 46 168 82 132 86 C116 88 106 78 104 62 Z"
          fill={colors.mikanLeaf}
        />
        {/* 葉の白いハイライト */}
        <Path
          d="M120 74 C132 58 150 44 166 38"
          stroke="#FFFFFF"
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
      </G>
      {/* ボディ */}
      <Ellipse cx="98" cy="122" rx="94" ry="72" fill={colors.mikan} />
      {face && (
        <G>
          {/* 目 */}
          <Circle cx="72" cy="120" r="9" fill="#FFFFFF" />
          <Circle cx="112" cy="120" r="9" fill="#FFFFFF" />
          {/* スマイル */}
          <Path
            d="M68 142 C78 158 104 158 114 142"
            stroke="#FFFFFF"
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
          {/* そばかす（3点） */}
          <Circle cx="140" cy="132" r="4.5" fill="#FFFFFF" />
          <Circle cx="132" cy="146" r="4.5" fill="#FFFFFF" />
          <Circle cx="148" cy="148" r="4.5" fill="#FFFFFF" />
        </G>
      )}
    </Svg>
  );
}
