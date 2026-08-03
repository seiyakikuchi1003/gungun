// プッシュ通知の送信ワーカー（Supabase Edge Function）
//
// notifications_to_push ビュー（0009）を読んで Expo の Push API に投げ、
// 送れたぶんの notifications.pushed_at を埋める。
//
// 【デプロイ】
//   supabase functions deploy send-push --no-verify-jwt
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... （既定で入っている場合は不要）
//
// 【定期実行】
//   Supabase の Cron（Integrations → Cron）から1〜5分おきに呼ぶ。
//   pg_cron から net.http_post で叩く形でもよい。
//
// 【なぜ pushed_at を埋めるのか】
//   埋めないと毎回同じ通知を送り直してしまう。ビュー側で
//   pushed_at is null の行だけを出しているので、送信後に必ず埋める。
//
// 【冪等性】
//   送信に成功した id だけを更新する。途中で落ちても、
//   次回は未送信ぶんだけが再度キューに出る（＝取りこぼしも二重送信もしない）。

import { createClient } from 'jsr:@supabase/supabase-js@2';

type Row = {
  id: string;
  user_id: string;
  type: string;
  body: string;
  related_id: string | null;
  token: string;
  platform: string;
};

/** Expo Push API に一度に投げられる件数 */
const CHUNK = 100;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** 通知の種類ごとのタイトル。本文は DB の body をそのまま使う */
const TITLE: Record<string, string> = {
  watered: '水やりが届きました',
  harvested: '収穫が成立しました',
  shipped: '商品が発送されました',
  received: '受け取りが完了しました',
  message: 'メッセージが届きました',
  board_comment: 'コメントが届きました',
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return new Response('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です', { status: 500 });
  }
  const db = createClient(url, key);

  // 未送信ぶんを取る（1回あたりの上限を決めて、詰まっても走り切れるようにする）
  const { data, error } = await db
    .from('notifications_to_push')
    .select('id, user_id, type, body, related_id, token, platform')
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    return new Response(`キューの取得に失敗: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return Response.json({ sent: 0, failed: 0, message: '送るものはありません' });
  }

  const sentIds: string[] = [];
  const deadTokens: string[] = [];
  let failed = 0;

  for (const batch of chunk(rows, CHUNK)) {
    const messages = batch.map((r) => ({
      to: r.token,
      title: TITLE[r.type] ?? 'ぐんぐん',
      body: r.body,
      sound: 'default',
      // アプリ側の usePushNavigation がこの data を見て遷移先を決める
      data: { type: r.type, related_id: r.related_id },
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body: JSON.stringify(messages),
      });
      const json = await res.json();
      const tickets: { status: string; details?: { error?: string } }[] = json.data ?? [];

      tickets.forEach((t, i) => {
        const row = batch[i];
        if (t.status === 'ok') {
          sentIds.push(row.id);
        } else {
          failed += 1;
          // 端末がアプリを消した／トークンが無効になった場合は掃除する
          if (t.details?.error === 'DeviceNotRegistered') deadTokens.push(row.token);
        }
      });
    } catch (e) {
      failed += batch.length;
      console.error('Expo Push API の呼び出しに失敗', e);
    }
  }

  // 送れたものだけ既送信にする（落ちた行は次回また拾われる）
  if (sentIds.length > 0) {
    const { error: upErr } = await db
      .from('notifications')
      .update({ pushed_at: new Date().toISOString() })
      .in('id', sentIds);
    if (upErr) console.error('pushed_at の更新に失敗', upErr);
  }

  // 無効なトークンを削除（残すと毎回失敗し続ける）
  if (deadTokens.length > 0) {
    await db.from('push_tokens').delete().in('token', [...new Set(deadTokens)]);
  }

  return Response.json({ sent: sentIds.length, failed, removedTokens: deadTokens.length });
});
