import React from 'react';
import { Image } from 'expo-image';

// ★ギフトの元画像。assets/brand/gift.png を差し替えれば全体に反映。
// 生成スクリプト: scripts/make-gift-art.py
const GIFT = require('../../../assets/brand/gift.png');

type Props = {
  size?: number;
};

/**
 * ギフト箱（画像ベース）。
 * アイコンフォントではなく実画像で統一するため、assets/brand/gift.png を表示する。
 */
export function GiftBox({ size = 48 }: Props) {
  return (
    <Image
      source={GIFT}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}
