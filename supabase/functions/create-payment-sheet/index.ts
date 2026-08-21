// アプリ内の支払いシート（Stripe Payment Sheet）に渡す情報を作る
//
// ブラウザに飛ばす Checkout と違い、アプリの中で下から出るシートで支払える。
// Apple Pay もこのシートの中に出る（Apple の作法どおりネイティブで動く）。
//
// 【呼び方】ログイン中の JWT をつけて POST する。
//   { "kind": "fertilizer", "planId": "c2" }   … 肥料の都度購入
//   { "kind": "premium" }                       … プレミアム（月額）
//
// 【返り値】
//   { paymentIntent, ephemeralKey, customer, publishableKey, amount, label }
//   アプリはこれを initPaymentSheet に渡すだけ。
//
// 【金額はここで決める】
//   アプリから金額を受け取らない。受け取ると改造して1円にできてしまう。
//
// 【付与は webhook 側】
//   支払いが通ったかどうかは Stripe からの通知で判断する。
//   このシートが閉じたことをアプリが報告しても、それだけでは肥料を増やさない。
//
// 【デプロイ】supabase functions deploy create-payment-sheet

import { createClient } from 'jsr:@supabase/supabase-js@2';

type Plan = { id: string; fertilizer: number; price: number; badge?: string };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Stripe API は form-urlencoded */
const form = (o: Record<string, string | number>) =>
  Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');

async function stripe(path: string, key: string, body?: Record<string, string | number>, version?: string) {
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (version) headers['Stripe-Version'] = version;
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? form(body) : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? 'Stripe の呼び出しに失敗しました');
  return j;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const sk = Deno.env.get('STRIPE_SECRET_KEY');
    const pk = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
    if (!url || !serviceKey || !sk) return json({ error: 'サーバの設定が足りません' }, 500);

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'ログインが必要です' }, 401);

    const db = createClient(url, serviceKey);
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'ログインが確認できません' }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const kind = body.kind === 'premium' ? 'premium' : 'fertilizer';

    // ── 金額は DB から ──────────────────────────────────
    const { data: rows } = await db
      .from('app_settings')
      .select('key, value')
      .in('key', ['charge_plans', 'premium_price_yen', 'premium_product']);
    const settings = new Map((rows ?? []).map((r) => [r.key, r.value]));

    // ── 顧客（同じ人に何度も顧客を作らない）────────────
    const { data: profile } = await db
      .from('profiles')
      .select('stripe_customer_id, nickname')
      .eq('id', user.id)
      .maybeSingle();

    let customer = profile?.stripe_customer_id as string | null;
    if (!customer) {
      const c = await stripe('customers', sk, {
        email: user.email ?? '',
        name: profile?.nickname ?? '',
        'metadata[user_id]': user.id,
      });
      customer = c.id;
      await db.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }

    // 支払いシートが保存済みカードを出せるようにする鍵
    const ephemeralKey = await stripe('ephemeral_keys', sk, { customer: customer! }, '2024-06-20');

    let clientSecret: string;
    let amount: number;
    let label: string;

    if (kind === 'fertilizer') {
      const plans = (settings.get('charge_plans') ?? []) as Plan[];
      const plan = plans.find((p) => p.id === body.planId);
      if (!plan) return json({ error: '販売プランが見つかりません: ' + body.planId }, 400);

      amount = plan.price;
      label = `${plan.fertilizer.toLocaleString()}肥料`;
      const pi = await stripe('payment_intents', sk, {
        amount,
        currency: 'jpy',
        customer: customer!,
        'automatic_payment_methods[enabled]': 'true',
        'metadata[user_id]': user.id,
        'metadata[kind]': 'fertilizer',
        'metadata[plan_id]': plan.id,
        'metadata[fertilizer]': plan.fertilizer,
        'metadata[price_jpy]': plan.price,
      });
      clientSecret = pi.client_secret;
    } else {
      const yen = Number(settings.get('premium_price_yen') ?? 0);
      if (!yen) return json({ error: 'プレミアムの金額が未設定です' }, 400);
      const days = Number((settings.get('premium_product') as { days?: number } | null)?.days ?? 30);

      amount = yen;
      label = 'ぐんぐんプレミアム（月額）';
      // サブスクの price_data は商品IDが要る（product_data は使えない）。
      // 商品は一度作れば使い回せるので、app_settings に控えておく。
      const prem = (settings.get('premium_product') ?? {}) as { days?: number; product_id?: string };
      let productId = prem.product_id;
      if (!productId) {
        const prod = await stripe('products', sk, { name: 'ぐんぐんプレミアム' });
        productId = prod.id;
        await db
          .from('app_settings')
          .update({ value: { ...prem, days, product_id: productId }, updated_at: new Date().toISOString() })
          .eq('key', 'premium_product');
      }

      // 毎月の請求を Stripe に任せる。最初の請求書の支払いをシートで済ませる
      const sub = await stripe('subscriptions', sk, {
        customer: customer!,
        'items[0][price_data][currency]': 'jpy',
        'items[0][price_data][product]': productId!,
        'items[0][price_data][recurring][interval]': 'month',
        'items[0][price_data][unit_amount]': yen,
        payment_behavior: 'default_incomplete',
        'payment_settings[save_default_payment_method]': 'on_subscription',
        'expand[0]': 'latest_invoice.confirmation_secret',
        'metadata[user_id]': user.id,
        'metadata[kind]': 'premium',
        'metadata[premium_days]': days,
        'metadata[price_jpy]': yen,
      });
      const secret = sub?.latest_invoice?.confirmation_secret?.client_secret;
      if (!secret) return json({ error: '支払い情報を用意できませんでした' }, 500);
      clientSecret = secret;
    }

    return json({
      paymentIntent: clientSecret,
      ephemeralKey: ephemeralKey.secret,
      customer,
      publishableKey: pk ?? null,
      amount,
      label,
    });
  } catch (e) {
    console.error('create-payment-sheet で例外', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
