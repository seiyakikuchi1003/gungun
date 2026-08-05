// Stripe Checkout のセッションを作る（Supabase Edge Function）
//
// アプリから「このプランを買いたい」とだけ受け取り、金額は必ず DB から引く。
// アプリに金額を送らせると、改造して1円で買えてしまうため。
//
// 【呼び方】アプリのログイン中セッションの JWT を Authorization につけて POST する。
//   { "kind": "fertilizer", "planId": "c2" }   … 肥料の都度購入
//   { "kind": "premium" }                       … プレミアム（月額サブスク）
//
// 【返り値】{ "url": "https://checkout.stripe.com/..." }
//   アプリはこの URL をブラウザで開く。支払い後は gungun:// で戻ってくる。
//
// 【デプロイ】
//   supabase functions deploy create-checkout-session
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...

import { createClient } from 'jsr:@supabase/supabase-js@2';

type Plan = { id: string; fertilizer: number; price: number; badge?: string };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** Stripe の API は form-urlencoded。ネストしたキーは a[b][c] の形にする */
function form(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!url || !serviceKey || !stripeKey) {
    return json({ error: 'サーバの設定が足りません（SUPABASE_URL / SERVICE_ROLE / STRIPE_SECRET_KEY）' }, 500);
  }

  // ── 誰が買おうとしているか（JWT から確定させる。body の user_id は信用しない）──
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'ログインが必要です' }, 401);

  const db = createClient(url, serviceKey);
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'ログインが確認できません' }, 401);
  const user = userData.user;

  let body: { kind?: string; planId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'リクエストが読めません' }, 400);
  }

  const kind = body.kind === 'premium' ? 'premium' : 'fertilizer';

  // ── 金額は DB から引く ────────────────────────────────────
  const { data: rows, error: sErr } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', ['charge_plans', 'premium_price_yen', 'premium_product']);
  if (sErr) return json({ error: '設定を読めません: ' + sErr.message }, 500);
  const settings = new Map((rows ?? []).map((r) => [r.key, r.value]));

  // 支払い後に戻ってくる先。アプリの scheme（app.json の "scheme": "gungun"）
  const success = 'gungun://purchase?status=success';
  const cancel = 'gungun://purchase?status=cancel';

  const params: Record<string, string | number> = {
    'success_url': success,
    'cancel_url': cancel,
    'client_reference_id': user.id,
    'metadata[user_id]': user.id,
    'metadata[kind]': kind,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'jpy',
  };

  if (kind === 'fertilizer') {
    const plans = (settings.get('charge_plans') ?? []) as Plan[];
    const plan = plans.find((p) => p.id === body.planId);
    if (!plan) return json({ error: '販売プランが見つかりません: ' + body.planId }, 400);

    params['mode'] = 'payment';
    params['line_items[0][price_data][unit_amount]'] = plan.price;
    params['line_items[0][price_data][product_data][name]'] = `${plan.fertilizer.toLocaleString()}肥料`;
    params['metadata[plan_id]'] = plan.id;
    params['metadata[fertilizer]'] = plan.fertilizer;
    params['metadata[price_jpy]'] = plan.price;
  } else {
    const yen = Number(settings.get('premium_price_yen') ?? 0);
    if (!yen) return json({ error: 'プレミアムの金額が未設定です' }, 400);
    const days = Number((settings.get('premium_product') as { days?: number } | null)?.days ?? 30);

    params['mode'] = 'subscription';
    params['line_items[0][price_data][unit_amount]'] = yen;
    params['line_items[0][price_data][recurring][interval]'] = 'month';
    params['line_items[0][price_data][product_data][name]'] = 'ぐんぐんプレミアム';
    params['metadata[premium_days]'] = days;
    params['metadata[price_jpy]'] = yen;
    // サブスクの毎回の課金にも metadata を引き継ぐ（更新時の付与に使う）
    params['subscription_data[metadata][user_id]'] = user.id;
    params['subscription_data[metadata][kind]'] = 'premium';
    params['subscription_data[metadata][premium_days]'] = days;
    params['subscription_data[metadata][price_jpy]'] = yen;
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + stripeKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form(params),
  });
  const session = await res.json();
  if (!res.ok) {
    return json({ error: 'Stripe: ' + (session?.error?.message ?? '不明なエラー') }, 500);
  }

  return json({ url: session.url, id: session.id });
});
