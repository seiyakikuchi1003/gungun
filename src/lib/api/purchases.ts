import { Linking } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { requireSupabase } from '@/lib/supabase';

/**
 * 課金。
 *
 * アプリの中で下から出る支払いシート（Stripe Payment Sheet）で支払う。
 * Apple Pay もこのシートの中に出る（Apple の作法どおりネイティブで動く）。
 *
 * 【安全のための決まり】
 * - 金額はアプリから送らない。Edge Function が DB（app_settings）から引く
 * - 肥料やプレミアムを付けるのは Stripe からの通知を検証したサーバだけ。
 *   シートが「成功」を返しただけでは付与しない（アプリは改造できるため）
 *
 * ⚠ App Store 審査ガイドライン 3.1.1 では、アプリ内で消費するデジタル財は
 *   In-App Purchase が必須とされる。審査提出前に方式を再確認すること。
 *   購入処理はこのファイルに閉じてあるので差し替えは容易。
 */

export type CheckoutKind = 'fertilizer' | 'premium';

type SheetParams = {
  paymentIntent: string;
  ephemeralKey: string;
  customer: string;
  amount: number;
  label: string;
};

/** 支払いの結果。cancelled は利用者が閉じただけなのでエラー扱いしない */
export type PayResult = { status: 'paid' | 'cancelled'; };

/**
 * 支払いシートを開いて支払う。
 * 支払いが通っても肥料が増えるのはサーバが通知を受けた後なので、
 * 呼び出し側は少し待ってから残高を取り直すこと。
 */
export async function pay(kind: CheckoutKind, planId?: string): Promise<PayResult> {
  const { data, error } = await requireSupabase().functions.invoke('create-payment-sheet', {
    body: { kind, planId },
  });
  if (error) {
    const detail = await readError(error);
    throw new Error(detail ?? '支払いを開始できませんでした');
  }
  const p = data as SheetParams | null;
  if (!p?.paymentIntent) throw new Error('支払い情報を取得できませんでした');

  const init = await initPaymentSheet({
    merchantDisplayName: 'ぐんぐん',
    customerId: p.customer,
    customerEphemeralKeySecret: p.ephemeralKey,
    paymentIntentClientSecret: p.paymentIntent,
    // ★ Apple Pay は Merchant ID（merchant.com.warashibe.gungun）を
    //   Apple Developer に登録してから有効にする。
    //   未登録のままだとプロビジョニングに Apple Pay の権限が付かず、ビルドが通らない。
    //   登録後、ここと app.json のプラグイン設定を戻せばシートに Apple Pay が出る。
    // applePay: { merchantCountryCode: 'JP' },
    allowsDelayedPaymentMethods: false,
    returnURL: 'gungun://purchase',
    defaultBillingDetails: {},
  });
  if (init.error) throw new Error(init.error.message);

  const res = await presentPaymentSheet();
  if (res.error) {
    // 利用者が閉じた場合はエラーにしない
    if (res.error.code === 'Canceled') return { status: 'cancelled' };
    throw new Error(res.error.message);
  }
  return { status: 'paid' };
}

async function readError(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response }).context;
  if (!ctx || typeof ctx.json !== 'function') return null;
  try {
    const body = await ctx.json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

/**
 * プレミアムの解約・支払い方法の変更ページ（Stripe のカスタマーポータル）を開く。
 * 解約フローを自前で作らず Stripe に任せている。
 */
export async function openBillingPortal(): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke('create-portal-session', { body: {} });
  if (error) {
    const detail = await readError(error);
    throw new Error(detail ?? '管理ページを開けませんでした');
  }
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('管理ページのURLを取得できませんでした');
  await Linking.openURL(url);
}
