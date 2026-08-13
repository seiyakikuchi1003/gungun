import { colors } from '@/theme';

/**
 * 取引の段階まわりの定義を1か所に集める（docs/gungun-retool-adopt.md 1-5）。
 *
 * ラベル・色・「次に何をするか」が画面ごとにバラバラだと、
 * 直したつもりの文言が別の画面に残る。ここだけを直せば全部が揃うようにする。
 *
 * ぐんぐんの段階（レンタルの返却系は入れない）：
 *   収穫 → 発送 → 受取 → 評価 → 完了
 */

export type ExchangeStatus = 'pending' | 'shipped' | 'received';

/** ステッパーに出す段。収穫は「輪ができた」時点で必ず済んでいる */
export const STEPS = ['収穫', '発送', '受取', '評価', '完了'] as const;
export type StepName = (typeof STEPS)[number];

/**
 * いま何段目か（0始まり）。
 * 評価は自分と相手の両方が出して初めて完了なので、そこだけ2段に分けている。
 */
export function currentStep(status: ExchangeStatus, iRated: boolean, partnerRated: boolean): number {
  if (status === 'pending') return 1;              // 発送待ち
  if (status === 'shipped') return 2;              // 受取待ち
  if (!iRated) return 3;                           // 自分の評価待ち
  if (!partnerRated) return 3.5;                   // 相手の評価待ち（評価の段のまま）
  return 4;                                        // 完了
}

/** ActionCard の見た目。自分の番／相手待ち／完了 */
export type Tone = 'brand' | 'pending' | 'done';

export const TONE: Record<Tone, { bg: string; border: string; text: string; icon: string }> = {
  // 自分が動く番。ブランドカラーで目立たせる
  brand:   { bg: colors.greenSoft,  border: colors.greenSoftBorder, text: colors.greenDeep,     icon: colors.green },
  // 相手の操作待ち。落ち着いた色にして「今は何もしなくていい」と分かるように
  pending: { bg: colors.bgWarm,     border: colors.border,          text: colors.textSecondary, icon: colors.textSecondary },
  // 終わったもの
  done:    { bg: colors.orangeSoft, border: colors.orange,          text: colors.orangeDeep,    icon: colors.orangeDeep },
};

export type Action = {
  tone: Tone;
  icon: string;
  title: string;
  body: string;
  /** ボタンを出す場合のラベル。null なら待つだけ */
  cta: string | null;
  /** 押したときに何をするか。画面側で解釈する */
  kind: 'ship' | 'receive' | 'rate' | 'ring' | 'address' | null;
};

/**
 * 「いま自分は何をすればいいのか」を1つに決める。
 *
 * 状態（pending / shipped / received）× 役割（送る人 / 受け取る人）×
 * 評価済みか、の組み合わせをここで潰しておく。画面には分岐を持ち込まない。
 */
export function nextAction(args: {
  status: ExchangeStatus;
  iAmSender: boolean;
  iRated: boolean;
  partnerRated: boolean;
  partnerName: string;
  /** 自分の住所が登録されているか（差出人として必要） */
  hasMyAddress: boolean;
}): Action {
  const { status, iAmSender, iRated, partnerRated, partnerName, hasMyAddress } = args;

  if (status === 'pending') {
    if (!iAmSender) {
      return {
        tone: 'pending', icon: 'time-outline',
        title: `${partnerName}さんの発送を待っています`,
        body: '発送されると通知が届きます。届いたら受け取り報告をしてください。',
        cta: null, kind: null,
      };
    }
    if (!hasMyAddress) {
      return {
        tone: 'brand', icon: 'home-outline',
        title: 'お届け先を登録してください',
        body: '差出人の住所が未登録のため発送に進めません。先に登録をお願いします。',
        cta: 'お届け先を登録する', kind: 'address',
      };
    }
    return {
      tone: 'brand', icon: 'cube-outline',
      title: '商品を発送してください',
      body: `下の宛先に発送し、完了したら発送報告をしてください。${partnerName}さんに通知が届きます。`,
      cta: '発送完了を報告する', kind: 'ship',
    };
  }

  if (status === 'shipped') {
    if (iAmSender) {
      return {
        tone: 'pending', icon: 'paper-plane-outline',
        title: '発送済みです',
        body: `${partnerName}さんの受け取り報告を待っています。`,
        cta: null, kind: null,
      };
    }
    return {
      tone: 'brand', icon: 'checkmark-done-outline',
      title: '商品が発送されました',
      body: '届いて中身を確認できたら、受け取り報告をしてください。',
      cta: '受け取りを報告する', kind: 'receive',
    };
  }

  // status === 'received'
  if (!iRated) {
    return {
      tone: 'brand', icon: 'star-outline',
      title: '評価をお願いします',
      body: iAmSender
        ? 'やり取りの印象を評価してください。評価が揃うと取引が完了します。'
        : '受け取った商品の状態を評価してください。評価が揃うと取引が完了します。',
      cta: '評価する', kind: 'rate',
    };
  }
  if (!partnerRated) {
    return {
      tone: 'pending', icon: 'hourglass-outline',
      title: '評価を送りました',
      body: `${partnerName}さんの評価を待っています。両方そろうと取引完了です。`,
      cta: 'みんなの輪を見る', kind: 'ring',
    };
  }
  return {
    tone: 'done', icon: 'trophy-outline',
    title: '取引が完了しました',
    body: 'おつかれさまでした。輪の全体を見て、次のタネを植えてみませんか？',
    cta: 'みんなの輪を見る', kind: 'ring',
  };
}

/** 一覧などに出す短いラベル */
export function statusLabel(status: ExchangeStatus, iAmSender: boolean): { text: string; tone: Tone } {
  if (status === 'pending') return iAmSender ? { text: '発送待ち', tone: 'brand' } : { text: '相手の発送待ち', tone: 'pending' };
  if (status === 'shipped') return iAmSender ? { text: '相手の受取待ち', tone: 'pending' } : { text: '受け取り待ち', tone: 'brand' };
  return { text: '評価・完了', tone: 'done' };
}
