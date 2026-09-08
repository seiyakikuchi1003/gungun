import { PixelRatio } from 'react-native';

/**
 * 行の高さを端末の文字サイズに追従させる（2026-08-21 指摘）。
 *
 * React Native の `lineHeight` は **文字サイズの設定に追従しない**。
 * fontSize は端末設定で大きくなるのに lineHeight は数値のまま固定なので、
 * 「文字サイズを大きく」した端末では行同士が重なって読めなくなる。
 * （ホームのログインボーナス「毎日 +40肥料」が潰れていたのがこれ）
 *
 * デザイン上の行間はそのまま保ちたいので、値を消すのではなく
 * 端末の倍率を掛ける。倍率が 1 のときは今までと同じ見た目になる。
 *
 * ※ StyleSheet は読み込み時に1度だけ評価されるので、
 *   アプリを起動したまま設定を変えた場合は次回起動から効く。
 *   iOS は文字サイズを変えるとアプリが作り直されることが多いため、
 *   実用上はこれで足りる。
 */
export function lh(n: number): number {
  return Math.round(n * PixelRatio.getFontScale());
}
