import React from 'react';
import { Image } from 'expo-image';

// ★アプリ内みかんマスコットの元画像。assets/brand/mikan.png を差し替えれば全体に反映。
const MIKAN = require('../../../assets/brand/mikan.png');

type Props = {
  size?: number;
  /** 互換用（画像ベースでは常に顔あり）。true/false は表示に影響しない。 */
  face?: boolean;
};

/**
 * みかんマスコット（画像ベース）。
 * アイコン・マスコットを実画像で統一するため、SVGではなく assets/brand/mikan.png を表示する。
 */
export function Mikan({ size = 96 }: Props) {
  return (
    <Image
      source={MIKAN}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}
