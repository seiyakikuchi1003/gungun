import { Linking } from 'react-native';
import { requireSupabase } from '@/lib/supabase';

/**
 * 課金（Web / 型チェック用のフォールバック）。
 *
 * ★ Stripe のネイティブSDKはここでは読み込まない。
 *   Web ビルドに混ざると「react-native の内部を import できない」で書き出しが失敗する。
 *   実機での支払い処理は purchases.native.ts にある（Metro が .native を優先する）。
 */

export type CheckoutKind = 'fertilizer' | 'premium';
export type PayResult = { status: 'paid' | 'cancelled' };

export async function pay(_kind: CheckoutKind, _planId?: string): Promise<PayResult> {
  throw new Error('お支払いはアプリからお願いします');
}

/** プレミアムの解約・支払い方法の変更（Stripe のカスタマーポータル） */
export async function openBillingPortal(): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke('create-portal-session', { body: {} });
  if (error) throw new Error('管理ページを開けませんでした');
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('管理ページのURLを取得できませんでした');
  await Linking.openURL(url);
}
