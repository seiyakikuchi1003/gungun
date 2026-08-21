import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * 画面で合わせた枠を、実際の画像の切り出しに変換する（2026-08-14 指摘）。
 *
 * 切り抜き画面は「枠は固定、写真を動かす」方式。
 * 画面上の見え方（移動量 tx/ty・倍率 scale）を、
 * 元画像のピクセル座標に置き換えてから切り出す。
 *
 * 【座標の考え方】
 * 写真は枠に対して cover 表示（短い辺を枠に合わせて、はみ出す分は隠れる）。
 * その表示倍率を base とすると、画面上の1pxは元画像の 1/(base*scale) px にあたる。
 * 枠の中心が元画像のどこを指しているかを求め、そこから枠の大きさぶんを切り出す。
 */

export type Ratio = 'square' | 'portrait' | 'landscape';

export type Frame = {
  ratio: Ratio;
  /** 枠の幅（画面px） */
  frame: number;
  tx: number;
  ty: number;
  scale: number;
};

function sizeOf(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export async function cropToFrame(uri: string, f: Frame): Promise<string> {
  const { width: iw, height: ih } = await sizeOf(uri);

  const fw = f.frame;
  const fh = f.ratio === 'square' ? f.frame : f.ratio === 'portrait' ? (f.frame * 4) / 3 : (f.frame * 3) / 4;

  // cover の倍率。短い方の辺が枠を満たすように拡大する
  const base = Math.max(fw / iw, fh / ih);
  const shown = base * f.scale;          // 実際に画面へ出ている倍率

  // 枠の中心が指している元画像の座標
  const cx = iw / 2 - f.tx / shown;
  const cy = ih / 2 - f.ty / shown;

  // 切り出す大きさ（元画像のピクセル）
  let cw = fw / shown;
  let ch = fh / shown;

  // 元画像からはみ出さないように寄せる
  cw = Math.min(cw, iw);
  ch = Math.min(ch, ih);
  const ox = Math.min(Math.max(cx - cw / 2, 0), iw - cw);
  const oy = Math.min(Math.max(cy - ch / 2, 0), ih - ch);

  const ctx = ImageManipulator.manipulate(uri).crop({
    originX: Math.round(ox),
    originY: Math.round(oy),
    width: Math.round(cw),
    height: Math.round(ch),
  });
  const image = await ctx.renderAsync();
  // アップロードの上限に当たらないよう、ここでも圧縮しておく
  const out = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return out.uri;
}
