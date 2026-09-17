// 運営からのメール送信（Supabase Edge Function）
//
// 2026-09-17 の指摘：管理画面から利用者にメールが送れない。全員選択や
// 複数選択もできず、一人ずつ探すしかない。
//
// 管理画面（Next.js のサーバー側）からだけ呼ぶ。Resend の API キーは
// Supabase の秘密情報にあり、管理画面の環境変数には置いていないため、ここを経由する。
//
// 【デプロイ】
//   supabase functions deploy admin-mail --no-verify-jwt
//   （呼び出し元の確認はこの中で、service_role でしか読めないビューを読めるかで行う）
//
// 【呼び方】
//   POST { action: 'status' }
//     → 送信元の設定と、Resend に登録されたドメインの認証状況を返す（何も送らない）
//   POST { action: 'send', subject, body, userIds: string[] }
//     → 指定した利用者に送る。宛先のメールアドレスはここで引く（管理画面から運ばない）
//
// 【送信元】
//   app_settings の mail_from（例：ぐんぐん <info@example.com>）。
//   Resend は認証済みのドメインからしか送れない。独自ドメインの設定（W-7）が
//   済むまでは送れないので、その場合は理由をそのまま返す。

import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Resend の一括送信 API は1回100通まで */
const BATCH = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 本文は運営が打った文字をそのまま使う。HTML として解釈させない */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toHtml(body: string): string {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="font-family:-apple-system,'Hiragino Kaku Gothic ProN',sans-serif;font-size:15px;line-height:1.8;color:#2C2A24;max-width:560px">${paragraphs}<hr style="border:none;border-top:1px solid #E7DFCD;margin:24px 0"><p style="font-size:12px;color:#7C776B;margin:0">このメールは ぐんぐん 運営事務局からお送りしています。</p></div>`;
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!url) return json({ error: 'サーバの設定が足りません' }, 500);

  // 管理画面以外からは呼ばせない。管理画面は service_role キーで呼んでくる。
  //
  // ★ 鍵の文字列を環境変数と突き合わせないこと（2026-09-17）。
  //   Edge Function 側の SUPABASE_SERVICE_ROLE_KEY は新しい形式（sb_secret_…）になっており、
  //   管理画面が持っている従来形式（JWT）の鍵とは文字列が一致しない。どちらも正しい鍵なのに弾いていた。
  //   service_role でしか読めないビュー（admin_user_cards）を、渡された鍵で実際に読めるかで判定する。
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!bearer) return json({ error: '権限がありません' }, 401);
  const caller = createClient(url, bearer, { auth: { persistSession: false } });
  const probe = await caller.from('admin_user_cards').select('id').limit(1);
  if (probe.error) return json({ error: '権限がありません' }, 401);

  let payload: { action?: string; subject?: string; body?: string; userIds?: string[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: '送られてきた内容を読めませんでした' }, 400);
  }

  const db = caller;
  const { data: fromRow } = await db.from('app_settings').select('value').eq('key', 'mail_from').maybeSingle();
  const from = typeof fromRow?.value === 'string' ? fromRow.value.trim() : '';

  // ── 送信元の状態だけを見る ─────────────────────────────────
  if (payload.action === 'status') {
    if (!resendKey) return json({ ready: false, from, reason: 'RESEND_API_KEY が設定されていません', domains: [] });
    const r = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (!r.ok) {
      return json({ ready: false, from, reason: `Resend に接続できませんでした（${r.status}）`, domains: [] });
    }
    const d = await r.json();
    const domains = (d.data ?? []).map((x: { name: string; status: string }) => ({ name: x.name, status: x.status }));
    const fromDomain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? '';
    const verified = domains.some(
      (x: { name: string; status: string }) => x.name.toLowerCase() === fromDomain && x.status === 'verified'
    );
    let reason = '';
    if (!from) reason = '送信元のアドレス（アプリ設定の「メールの送信元」）が未設定です';
    else if (!domains.length) reason = 'Resend に送信用のドメインが登録されていません';
    else if (!verified) reason = `送信元のドメイン（${fromDomain}）が Resend で認証されていません`;
    return json({ ready: !reason, from, reason, domains });
  }

  // ── 送る ───────────────────────────────────────────────────
  if (payload.action !== 'send') return json({ error: '不明な操作です' }, 400);

  const subject = (payload.subject ?? '').trim();
  const body = (payload.body ?? '').trim();
  const ids = [...new Set((payload.userIds ?? []).filter(Boolean))];
  if (!subject) return json({ error: '件名を入力してください' }, 400);
  if (!body) return json({ error: '本文を入力してください' }, 400);
  if (!ids.length) return json({ error: '宛先が選ばれていません' }, 400);
  if (!resendKey) return json({ error: 'RESEND_API_KEY が設定されていません' }, 500);
  if (!from) return json({ error: '送信元のアドレス（アプリ設定の「メールの送信元」）が未設定です' }, 400);

  // 宛先のアドレスはここで引く。管理画面からアドレスそのものは受け取らない
  const recipients: string[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await db
      .from('admin_user_cards')
      .select('email')
      .in('id', ids.slice(i, i + 500));
    if (error) return json({ error: `宛先を引けませんでした（${error.message}）` }, 500);
    for (const r of data ?? []) if (r.email) recipients.push(r.email);
  }
  if (!recipients.length) return json({ error: '選んだ人にメールアドレスがありません' }, 400);

  const html = toHtml(body);
  let sent = 0;
  let failed = 0;
  let firstError = '';

  // 1通ずつ宛先を分けて送る（to に全員を並べると、他の人のアドレスが見えてしまう）
  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH).map((to) => ({ from, to, subject, html, text: body }));
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (r.ok) {
      sent += chunk.length;
    } else {
      failed += chunk.length;
      if (!firstError) {
        const detail = await r.json().catch(() => ({}));
        firstError = detail?.message ?? `Resend がエラーを返しました（${r.status}）`;
      }
    }
  }

  await db.from('admin_mail_log').insert({
    subject,
    body,
    recipient_count: recipients.length,
    sent_count: sent,
    failed_count: failed,
    error: firstError || null,
  });

  return json({ sent, failed, total: recipients.length, error: firstError || null });
});
