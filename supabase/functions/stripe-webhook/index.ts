// Stripe からの通知を受けて、肥料・プレミアムを実際に付与する（Supabase Edge Function）
//
// ★付与はここでしか行わない。
//   アプリが「買えました」と言ってきても信用しない（改造できるため）。
//   Stripe から直接届いた・署名が正しい通知だけを根拠にする。
//
// 【扱うイベント】
//   checkout.session.completed … 肥料の都度購入、プレミアムの初回
//   invoice.paid               … プレミアムの2回目以降（毎月の更新）
//
// 【二重付与の防止】
//   redeem_purchase() が (platform, transaction_id) の一意制約で弾く（0009）。
//   Stripe は同じイベントを再送することがあるので、この冪等性が必須。
//
// 【デプロイ】
//   supabase functions deploy stripe-webhook --no-verify-jwt
//     ← Stripe は Supabase の JWT を持っていないので --no-verify-jwt が必要。
//        代わりに署名（STRIPE_WEBHOOK_SECRET）で本物か確かめる。
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...

import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Stripe の署名ヘッダを検証する（Webhook signatures / scheme v1） */
async function verify(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // 5分より古い通知は受け付けない（リプレイ対策）
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // 長さが同じときだけ定数時間で比較する
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!url || !serviceKey || !secret) return new Response('サーバの設定が足りません', { status: 500 });

  const raw = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  if (!(await verify(raw, sig, secret))) {
    // 署名が合わない＝Stripe 以外からの呼び出し。付与しない。
    return new Response('署名が不正です', { status: 400 });
  }

  const event = JSON.parse(raw);
  const db = createClient(url, serviceKey);

  /** metadata から付与内容を組み立てて DB に反映する */
  const grant = async (meta: Record<string, string>, transactionId: string, rawObj: unknown) => {
    const userId = meta.user_id;
    if (!userId) return { ok: false, why: 'metadata に user_id がありません' };
    const kind = meta.kind === 'premium' ? 'premium' : 'fertilizer';

    const { data, error } = await db.rpc('redeem_purchase', {
      p_user: userId,
      p_platform: 'stripe',
      p_kind: kind,
      p_product_id: meta.plan_id ?? (kind === 'premium' ? 'premium_monthly' : 'unknown'),
      p_transaction_id: transactionId,
      p_fertilizer: kind === 'fertilizer' ? Number(meta.fertilizer ?? 0) : 0,
      p_premium_days: kind === 'premium' ? Number(meta.premium_days ?? 30) : 0,
      p_price_jpy: meta.price_jpy ? Number(meta.price_jpy) : null,
      p_raw: rawObj as Record<string, unknown>,
    });
    if (error) return { ok: false, why: error.message };
    // false = このレシートは処理済み（Stripe の再送）。正常系として扱う
    return { ok: true, granted: data === true };
  };

  let result: { ok: boolean; why?: string; granted?: boolean } = { ok: true, granted: false };

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    if (s.payment_status === 'paid' || s.mode === 'subscription') {
      result = await grant(s.metadata ?? {}, `cs_${s.id}`, s);
    }
  } else if (event.type === 'invoice.paid') {
    // プレミアムの2回目以降。metadata はサブスクから引く
    const inv = event.data.object;
    let meta: Record<string, string> = inv.subscription_details?.metadata ?? {};
    if (!meta.user_id && inv.subscription && stripeKey) {
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${inv.subscription}`, {
        headers: { Authorization: 'Bearer ' + stripeKey },
      });
      if (r.ok) meta = (await r.json()).metadata ?? {};
    }
    // 初回の invoice は checkout.session.completed と重複するので、
    // transaction_id を invoice 単位にして冪等性を効かせる
    if (meta.user_id) result = await grant(meta, `in_${inv.id}`, inv);
  }

  if (!result.ok) {
    // 200 以外を返すと Stripe が再送してくれる（取りこぼさない）
    console.error('付与に失敗', result.why, event.type);
    return new Response('付与に失敗: ' + result.why, { status: 500 });
  }

  return Response.json({ received: true, type: event.type, granted: result.granted ?? false });
});
