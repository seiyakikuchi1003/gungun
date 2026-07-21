/**
 * ぐんぐん デザイントークン
 *
 * 値の出どころ：
 *  - docs/gungun-spec.md 第5章「デザイントークン」
 *  - 提供されたモックアップ画像（ログイン／新規登録／タネを植える／商品詳細＋水やり）
 *
 * SPEC のトークンを基準にしつつ、画像から実測した色味に寄せている。
 * 迷った箇所は末尾コメントに根拠を残す。
 * すべて `as const` で型安全に。
 */

export const colors = {
  // 背景：SPEC は #FDF8F0。実画像はもう少し温かいクリームのため中間値を採用。
  bg: '#F7F1E0',
  bgWarm: '#FBF6EC',

  // カード
  card: '#FFFFFF',
  // 入力欄などの淡いグレーがかったカード（タネを植える画面の商品名/説明）
  cardMuted: '#F2EFE7',

  // メイン（グリーン）＝ボタン・アクティブ・「受け取る」
  green: '#2E9E5B', // ロゴ・リンク・アクティブ
  greenDeep: '#2C8547', // 大きなピルボタン（画像のボタンは少し濃い）
  greenDark: '#236B39', // 押下・グラデ下端
  greenSoft: '#E6F0DD', // 案内ボックス背景（薄い緑）
  greenSoftBorder: '#CFE3BF',

  // アクセント（オレンジ）＝「送る」・収穫タブ・強調
  orange: '#F5A623',
  orangeDeep: '#E8901C',
  orangeSoft: '#FCEBCE', // 薄いオレンジの案内ボックス背景

  // マスコット
  mikan: '#EF8E2A',
  mikanLeaf: '#82BF4B',
  leafDecor: '#CBE0AA', // 背景装飾の葉

  // テキスト
  textPrimary: '#333333',
  textSecondary: '#7C776B', // 補足のミディアムグレー（やや温かい）
  textPlaceholder: '#B4AEA1',
  textOnDark: '#FFFFFF',
  textGreen: '#2E9E5B',

  // 境界・区切り
  border: '#EAE4D6',
  borderInput: '#ECE7DC',
  divider: '#EFE9DC',

  // ステータスバッジ（出品中=緑／取引中=オレンジ／収穫済み=グレー）
  statusGrowing: '#2E9E5B',
  statusTrading: '#F5A623',
  statusCompleted: '#A9A498',

  // 水やり（青系）＝「水やりする」ボタン・自分が出す子商品の強調
  waterBlue: '#2E7CF6',
  waterBlueSoft: '#AEC9F7',
  waterBlueBg: '#EAF2FE',

  // その他
  heart: '#E8637A',
  premium: '#C9922E',
  overlay: 'rgba(45, 40, 30, 0.45)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** スペーシング（4の倍数） */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

/** 角丸 */
export const radius = {
  sm: 8,
  md: 12,
  card: 16, // カード（SPEC）
  lg: 20,
  input: 16, // 入力欄
  pill: 999, // ボタン・バッジ
} as const;

/**
 * フォント（Noto Sans JP）
 * 見出しは太字。数値強調は Black。
 */
// 角丸ゴシック M PLUS Rounded 1c で「緩い・親しみやすい」印象に。
// black は 800(ExtraBold) を採用（900だと重すぎるため、柔らかさを優先）。
export const fonts = {
  regular: 'MPLUSRounded1c_400Regular',
  medium: 'MPLUSRounded1c_500Medium',
  bold: 'MPLUSRounded1c_700Bold',
  black: 'MPLUSRounded1c_800ExtraBold',
} as const;

/** タイポグラフィ（fontFamily + サイズ + 行間） */
export const typography = {
  displayLg: { fontFamily: fonts.black, fontSize: 40, lineHeight: 48 }, // 新規登録 見出し
  headingLg: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34 },
  headingMd: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  headingSm: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyMd: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  captionMd: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18 },
  button: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  // 数値強調（肥料残高など）
  numberLg: { fontFamily: fonts.black, fontSize: 28, lineHeight: 32 },
  numberMd: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24 },
} as const;

/** iOS 用シャドウ */
export const shadows = {
  card: {
    shadowColor: '#8A6D3B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  soft: {
    shadowColor: '#8A6D3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  button: {
    shadowColor: '#2C7A3F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
} as const;

export const theme = { colors, spacing, radius, fonts, typography, shadows } as const;
export type Theme = typeof theme;

// ── 実測根拠メモ ──────────────────────────────────────────────
// bg           : ログイン/新規登録画面のクリーム地。SPEC #FDF8F0 よりやや温色 → #F7F1E0
// green        : 「ぐんぐん」ロゴ文字・「新規登録」見出し・リンク文字
// greenDeep    : 「ログイン」「登録する」「タネを植える」ピルボタンの緑（ロゴより濃い）
// orange       : みかんマスコット地色・収穫タブ・「送る」
// greenSoft    : タネを植える画面の案内ボックス「交換の輪がはじまります」の背景
// cardMuted    : 商品名/商品の説明の入力カードの淡いグレー地
// textSecondary: 「ゲーム・おもちゃ」「たくさんさんのタネ」などの補足グレー
