import React from 'react';
import { Image } from 'expo-image';

type Props = { size?: number };

const WATERING_CAN = require('../../../assets/brand/wateringcan.png');
// 元画像のアスペクト比（横長）。size を「幅」の基準にして高さを比率で決める。
const RATIO = 468 / 800;

/**
 * じょうろマスコット（水やり確認モーダルの主役）。
 * 実画像ベース。横長のため高さは幅に対して比率で調整して歪ませない。
 */
export function WateringCan({ size = 120 }: Props) {
  return (
    <Image
      source={WATERING_CAN}
      style={{ width: size, height: size * RATIO }}
      contentFit="contain"
      transition={150}
    />
  );
}
