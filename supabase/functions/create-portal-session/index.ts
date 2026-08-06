// プレミアムの解約・支払い方法の変更ページ（Stripe カスタマーポータル）を開く
//
// 解約フローを自前で作らず Stripe に任せる。
// 支払い方法の変更・請求書の確認・解約が一通りそろっており、
// 自前で作るより確実で、表示義務のある項目も Stripe 側が用意している。
//
// 【呼び方】ログイン中のセッションの JWT をつけて POST するだけ。
// 【返り値】{ "url": "https://billing.stripe.com/..." }
//
// 【デプロイ】supabase functions deploy create-portal-session

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!url || !serviceKey || !stripeKey) return json({ error: 'サーバの設定が足りません' }, 500);

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'ログインが必要です' }, 401);

    const db = createClient(url, serviceKey);
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'ログインが確認できません' }, 401);

    const { data: profile } = await db
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userData.user.id)
      .maybeSingle();

    const customer = profile?.stripe_customer_id;
    if (!customer) {
      // 一度も課金していない人。解約するものが無い
      return json({ error: 'お支払いの記録がありません' }, 400);
    }

    const body = new URLSearchParams();
    body.set('customer', customer);
    body.set('return_url', 'gungun://premium');

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const session = await res.json();
    if (!res.ok) return json({ error: 'Stripe: ' + (session?.error?.message ?? '不明なエラー') }, 500);

    return json({ url: session.url });
  } catch (e) {
    console.error('create-portal-session で例外', e);
    return json({ error: '内部エラー: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
