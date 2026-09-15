/**
 * 検索の文字ゆれを吸収する（2026-09-14 指摘）。
 *
 * これまでは商品名と説明文をつないで小文字にし、そのまま含むかを見ていた。
 * そのため「テスト」で検索すると、説明文に「テスト」と書いてある別の商品まで
 * 引っかかり、逆に「かめら」では「カメラ」が見つからなかった。
 *
 * 決めごと：
 *   ・探すのは**商品名だけ**。説明文は対象にしない
 *   ・ひらがな・カタカナ・半角カナは区別しない（かめら＝カメラ＝ｶﾒﾗ）
 *   ・漢字は漢字のまま（読みでは引かない）
 *   ・連続した文字列の部分一致。「カメラ」に対して「メラ」は当たるが、
 *     1文字飛ばした「カラ」は当たらない
 */
export function normalizeSearch(input: string): string {
  return input
    // 半角カナ→全角カナ、全角英数→半角英数をそろえる
    .normalize('NFKC')
    .toLowerCase()
    // カタカナ→ひらがな。長音符（ー）は共通なのでそのまま
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .trim();
}

/** 商品名が検索語を含むか */
export function matchesName(name: string, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(name).includes(q);
}
