import { Linking } from 'react-native';
import { requireSupabase } from '@/lib/supabase';

/**
 * 課金（Stripe Checkout）。
 *
 * アプリは「どのプランを買いたいか」だけを送る。
 * 金額は Edge Function が DB（app_settings）から引くので、
 * アプリを改造しても値段は変えられない。
 *
 * 付与も Edge Function（stripe-webhook）が Stripe からの通知を検証してから行う。
 * アプリが「買えました」と言っても肥料は増えない。
 *
 * ⚠ App Store 審査ガイドライン 3.1.1 では、アプリ内で消費するデジタル財は
 *   In-App Purchase が必須とされる。審査提出前に方式を再確認すること。
 *   差し替えやすいよう、購入処理はこのファイルに閉じてある。
 */

export type CheckoutKind = 'fertilizer' | 'premium';

/**
 * 決済画面のURLを作って開く。
 * 支払いが終わると gungun://purchase?status=success でアプリに戻る。
 */
export async function startCheckout(kind: CheckoutKind, planId?: string): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke('create-checkout-session', {
    body: { kind, planId },
  });
  if (error) {
    // Edge Function が返したエラー本文を拾えるなら、そちらを見せる
    const detail = await readError(error);
    throw new Error(detail ?? '決済画面を開けませんでした');
  }
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('決済画面のURLを取得できませんでした');

  const ok = await Linking.canOpenURL(url);
  if (!ok) throw new Error('ブラウザを開けませんでした');
  await Linking.openURL(url);
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
