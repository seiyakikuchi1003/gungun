import React, { forwardRef } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextInputProps,
} from 'react-native';

/**
 * 文字サイズに上限をかけた Text / TextInput（2026-09-17 指摘）。
 *
 * iPhone の文字サイズを最大にすると、どう組んでも文字が切れる・枠からはみ出す。
 * Instagram や PayPay も、端末の設定に合わせて大きくはなるが
 * ある所で止まるようになっている。ぐんぐんも同じにする。
 *
 * ★ アプリの中では react-native の Text / TextInput を直接使わず、ここから読むこと。
 *   React Native には「全部の Text にまとめて上限をかける」手段が無い
 *   （RN 0.81 の Text は関数コンポーネントで、React 19 では defaultProps が効かない）。
 *   そのため読み込み元をここに寄せて、既定値として上限を渡している。
 *
 * 個別に maxFontSizeMultiplier を渡した場合はそちらが優先される
 * （小さな丸バッジなど、さらに抑えたい所は 1.2 などを指定している）。
 */

/**
 * 端末の文字サイズを何倍まで反映するか。
 *
 * iOS の標準の設定でいちばん大きい文字（アクセシビリティの「さらに大きな文字」を
 * 使わない範囲の最大）がおよそ 1.35 倍。そこまでは大きくなり、
 * それより上の設定にしてもこの倍率で止まる。
 */
export const MAX_FONT_SCALE = 1.3;

export const Text = forwardRef<React.ElementRef<typeof RNText>, TextProps>(function Text(props, ref) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />;
});

export const TextInput = forwardRef<React.ElementRef<typeof RNTextInput>, TextInputProps>(
  function TextInput(props, ref) {
    return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />;
  }
);
