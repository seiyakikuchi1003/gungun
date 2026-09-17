'use server';

import { revalidatePath } from 'next/cache';
import { admin } from './supabase';

/**
 * 管理画面の書き込み操作をまとめた所。
 *
 * ★ どの操作も必ず監査ログ（admin_audit_log）に残すこと。
 *   引き継ぎ後に「誰が・いつ・何をしたか」を追えるようにするため。
 *   「操作の記録」画面はこのログを読んでいる。
 */

type Result = { error?: string };

async function audit(action: string, targetType: string, targetId: string, detail?: unknown) {
  try {
    await admin().from('admin_audit_log').insert({
      actor: 'admin',
      action,
      target_type: targetType,
      target_id: targetId,
      detail: detail ?? null,
    });
  } catch {
    // 監査ログの失敗で本処理を巻き戻さない
  }
}

/**
 * 本人に「運営からのお知らせ」を届ける（アプリの通知一覧＋プッシュ）。
 *
 * 非表示・警告・停止をしたとき、本人には何も伝わっていなかった（2026-09-17 指摘）。
 * 一般的なアプリと同じく、何をされたのかを本人に知らせる。
 */
async function notifyUser(userId: string | null | undefined, body: string) {
  if (!userId) return;
  try {
    await admin().from('notifications').insert({ user_id: userId, type: 'admin_notice', body });
  } catch {
    // 通知が送れなくても運営の操作自体は成立させる
  }
}

function refresh(...paths: string[]) {
  for (const p of ['/', ...paths]) revalidatePath(p);
}

// ── ユーザー ───────────────────────────────────────────────

/**
 * 利用停止／解除。
 *
 * 停止中の人はアプリを開くと「利用を停止しています」の画面になり、何もできない。
 * サーバ側でも出品・水やり・投稿・コメントは弾いている（0004 / 0011）。
 */
export async function setSuspended(userId: string, suspended: boolean, reason: string): Promise<Result> {
  const text = reason.trim();
  if (suspended && !text) return { error: '停止の理由を入力してください（本人に表示されます）' };

  const { error } = await admin()
    .from('profiles')
    .update({
      is_suspended: suspended,
      suspended_reason: suspended ? text : null,
      suspended_at: suspended ? new Date().toISOString() : null,
    })
    .eq('id', userId);
  if (error) return { error: error.message };

  await notifyUser(
    userId,
    suspended
      ? `利用規約に反する行為が確認されたため、アカウントの利用を停止しました。理由：${text}`
      : 'アカウントの利用停止を解除しました。引き続きぐんぐんをお楽しみください。'
  );
  await audit(suspended ? 'suspend_user' : 'unsuspend_user', 'user', userId, { reason: text });
  refresh('/users', `/users/${userId}`);
  return {};
}

/** 警告だけを送る（停止まではしない） */
export async function warnUser(userId: string, message: string): Promise<Result> {
  const text = message.trim();
  if (!text) return { error: '警告の内容を入力してください' };
  await notifyUser(userId, `【運営からの警告】${text}`);
  await audit('warn_user', 'user', userId, { message: text });
  refresh(`/users/${userId}`);
  return {};
}

/** 肥料の手動付与／減算。残高だけでなく台帳にも必ず記録する */
export async function grantFertilizer(userId: string, amount: number): Promise<Result> {
  if (!Number.isFinite(amount) || amount === 0) return { error: '増やす量（減らすときはマイナス）を入力してください' };

  const db = admin();
  const { data: profile, error: readError } = await db
    .from('profiles')
    .select('fertilizer')
    .eq('id', userId)
    .single();
  if (readError) return { error: readError.message };

  const next = Math.max(0, (profile?.fertilizer ?? 0) + amount);
  const { error } = await db.from('profiles').update({ fertilizer: next }).eq('id', userId);
  if (error) return { error: error.message };

  await db.from('fertilizer_ledger').insert({ user_id: userId, amount, reason: 'admin' });
  await audit('grant_fertilizer', 'user', userId, { amount, balance: next });
  refresh('/users', `/users/${userId}`);
  return {};
}

/**
 * プレミアムを運営が付ける／外す（2026-09-17 指摘）。
 *
 * Stripe は公開の直前までテストモードで運用するため、決済からは本物のプレミアムに
 * ならない。確認や特別対応のために、管理画面から直接付けられるようにする。
 *
 * until を null にすると期限なし。期限を過ぎると、次のログインボーナスの受け取り時に
 * 自動で外れる（0038）。
 */
export async function setPremium(userId: string, on: boolean, until: string | null): Promise<Result> {
  let untilIso: string | null = null;
  if (on && until) {
    // 日付だけ受け取るので、その日の終わり（日本時間）までを有効にする
    const d = new Date(`${until}T23:59:59+09:00`);
    if (Number.isNaN(d.getTime())) return { error: '有効期限の日付を読めませんでした' };
    if (d.getTime() <= Date.now()) return { error: '有効期限は今日以降の日付にしてください' };
    untilIso = d.toISOString();
  }

  const { error } = await admin()
    .from('profiles')
    .update({ is_premium: on, premium_until: on ? untilIso : null })
    .eq('id', userId);
  if (error) return { error: error.message };

  await audit(on ? 'grant_premium' : 'revoke_premium', 'user', userId, { until: untilIso });
  refresh('/users', `/users/${userId}`);
  return {};
}

// ── 商品 ───────────────────────────────────────────────────

/** 物理削除はしない（ツリーの整合性が壊れるため）。status を deleted にして非表示にする */
export async function softDeleteItem(itemId: string, reason = ''): Promise<Result> {
  const db = admin();
  const { data: item } = await db.from('items').select('user_id, name').eq('id', itemId).maybeSingle();
  const { error } = await db.from('items').update({ status: 'deleted' }).eq('id', itemId);
  if (error) return { error: error.message };

  await notifyUser(
    item?.user_id,
    `出品「${item?.name ?? '商品'}」を運営が非表示にしました。${reason ? `理由：${reason}` : '利用規約に反する内容が含まれていたためです。'}`
  );
  await audit('delete_item', 'item', itemId, { reason });
  refresh('/items');
  return {};
}

export async function restoreItem(itemId: string): Promise<Result> {
  const { error } = await admin().from('items').update({ status: 'growing' }).eq('id', itemId);
  if (error) return { error: error.message };

  await audit('restore_item', 'item', itemId);
  refresh('/items');
  return {};
}

// ── 掲示板・コメント ──────────────────────────────────────

type ContentTable = 'board_posts' | 'board_comments' | 'item_comments';

const CONTENT_LABEL: Record<ContentTable, string> = {
  board_posts: '掲示板の投稿',
  board_comments: '掲示板のコメント',
  item_comments: '商品へのコメント',
};

/**
 * 投稿・コメントの非表示／再表示（2026-09-17 指摘：掲示板を管理する場所が無い）。
 *
 * 消さずに隠す。通報と突き合わせられるよう本文は残す。非表示のものは
 * アプリから読めない（0055 の RLS）。書いた本人には運営からのお知らせを送る。
 */
export async function setContentHidden(
  table: ContentTable,
  id: string,
  hidden: boolean,
  reason = ''
): Promise<Result> {
  const db = admin();
  const { data: row } = await db.from(table).select('user_id, body').eq('id', id).maybeSingle();
  const { error } = await db
    .from(table)
    .update({ hidden_at: hidden ? new Date().toISOString() : null, hidden_reason: hidden ? reason || null : null })
    .eq('id', id);
  if (error) return { error: error.message };

  if (hidden) {
    const excerpt = (row?.body ?? '').replace(/\s+/g, ' ').slice(0, 20);
    await notifyUser(
      row?.user_id,
      `あなたの${CONTENT_LABEL[table]}「${excerpt}${(row?.body ?? '').length > 20 ? '…' : ''}」を運営が非表示にしました。${reason ? `理由：${reason}` : '利用規約に反する内容が含まれていたためです。'}`
    );
  }
  await audit(hidden ? 'hide_content' : 'unhide_content', table, id, { reason });
  refresh('/board', '/reports');
  return {};
}

// ── 通報 ───────────────────────────────────────────────────

export type ReportAction = 'hide_content' | 'warn_user' | 'suspend_user' | 'none';

/**
 * 通報に対応する（2026-09-17 指摘）。
 *
 * これまでの「対応済み」は通報の状態を書き換えるだけで、相手には何も起きなかった。
 * 一般的なアプリと同じく、対応の中身を選んで実際に効かせる：
 *
 *   hide_content  … 通報された商品・投稿・コメントを非表示にし、投稿者に知らせる
 *   warn_user     … 投稿者に警告のお知らせを送る（投稿はそのまま）
 *   suspend_user  … 投稿者の利用を停止する（アプリが使えなくなる）
 *   none          … 問題なし。何もせず閉じる
 *
 * どれを選んだかは reports.action_taken に残す。
 */
export async function handleReport(
  reportId: string,
  action: ReportAction,
  note: string
): Promise<Result> {
  const db = admin();
  const { data: report, error: readError } = await db
    .from('reports')
    .select('id, target_type, target_id')
    .eq('id', reportId)
    .maybeSingle();
  if (readError || !report) return { error: readError?.message ?? '通報が見つかりませんでした' };

  // 通報された内容を書いた人（＝対応の相手）
  const ownerOf = async (): Promise<string | null> => {
    const t = report.target_type as string;
    if (t === 'user') return report.target_id;
    const table = t === 'item' ? 'items' : t === 'board_post' ? 'board_posts' : t === 'board_comment' ? 'board_comments' : null;
    if (!table) return null;
    const { data } = await db.from(table).select('user_id').eq('id', report.target_id).maybeSingle();
    return data?.user_id ?? null;
  };

  const reason = note.trim();
  let res: Result = {};

  if (action === 'hide_content') {
    const t = report.target_type as string;
    if (t === 'item') res = await softDeleteItem(report.target_id, reason);
    else if (t === 'board_post') res = await setContentHidden('board_posts', report.target_id, true, reason);
    else if (t === 'board_comment') res = await setContentHidden('board_comments', report.target_id, true, reason);
    else return { error: 'ユーザーの通報は非表示にできません。警告か利用停止を選んでください' };
  } else if (action === 'warn_user') {
    const owner = await ownerOf();
    if (!owner) return { error: '対象の投稿者が見つかりませんでした（退会済みの可能性があります）' };
    res = await warnUser(owner, reason || '利用規約に反する行為についての通報がありました。今後同様の行為が続く場合、利用を停止することがあります。');
  } else if (action === 'suspend_user') {
    const owner = await ownerOf();
    if (!owner) return { error: '対象の投稿者が見つかりませんでした（退会済みの可能性があります）' };
    if (!reason) return { error: '利用停止の理由を入力してください（本人に表示されます）' };
    res = await setSuspended(owner, true, reason);
  }
  if (res.error) return res;

  const { error } = await db
    .from('reports')
    .update({
      status: action === 'none' ? 'dismissed' : 'resolved',
      action_taken: action,
      handled_at: new Date().toISOString(),
      handled_note: reason || null,
    })
    .eq('id', reportId);
  if (error) return { error: error.message };

  await audit('handle_report', 'report', reportId, { action, note: reason });
  refresh('/reports');
  return {};
}

/** 対応を取り消して「未対応」に戻す（行った非表示・停止は各画面で個別に戻す） */
export async function reopenReport(reportId: string): Promise<Result> {
  const { error } = await admin()
    .from('reports')
    .update({ status: 'open', action_taken: null, handled_at: null, handled_note: null })
    .eq('id', reportId);
  if (error) return { error: error.message };
  await audit('reopen_report', 'report', reportId);
  refresh('/reports');
  return {};
}

// ── メール ─────────────────────────────────────────────────

type MailStatus = { ready: boolean; from: string; reason: string; domains: { name: string; status: string }[] };

async function callMailFunction(payload: unknown): Promise<any> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('データベースに接続されていません');
  const r = await fetch(`${url}/functions/v1/admin-mail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error ?? `送信の処理に失敗しました（${r.status}）`);
  return body;
}

/** 送信元が使える状態か（何も送らない） */
export async function mailStatus(): Promise<MailStatus> {
  try {
    return await callMailFunction({ action: 'status' });
  } catch (e) {
    return { ready: false, from: '', reason: e instanceof Error ? e.message : String(e), domains: [] };
  }
}

/** 選んだ利用者にメールを送る */
export async function sendMail(
  userIds: string[],
  subject: string,
  body: string
): Promise<Result & { sent?: number; failed?: number; total?: number }> {
  if (!userIds.length) return { error: '宛先を1人以上選んでください' };
  try {
    const r = await callMailFunction({ action: 'send', userIds, subject, body });
    await audit('send_mail', 'mail', subject, { total: r.total, sent: r.sent, failed: r.failed });
    refresh('/mail');
    if (r.failed > 0 && r.sent === 0) return { error: r.error ?? '送信に失敗しました', ...r };
    return { sent: r.sent, failed: r.failed, total: r.total };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ── アプリ設定 ─────────────────────────────────────────────

/**
 * app_settings は jsonb。管理画面からは文字列で受け取り、
 * 数値／真偽値として解釈できるものはその型で保存する（アプリ側が int を期待するため）。
 */
export async function saveSetting(key: string, raw: string, kind = ''): Promise<Result> {
  const text = raw.trim();
  let value: unknown = text;
  if (/^-?\d+(\.\d+)?$/.test(text)) value = Number(text);
  else if (text === 'true' || text === 'false') value = text === 'true';
  // JSON の項目（販売プランなど）は、文字列のまま保存するとアプリが読めない。
  // これまでは文字列として保存しており、編集するとチャージ画面が壊れる状態だった（2026-09-17）
  if (kind === 'json') {
    try {
      value = JSON.parse(text);
    } catch {
      return { error: 'JSON の形が正しくありません。括弧や「,」を確認してください' };
    }
  }

  const { error } = await admin()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return { error: error.message };

  await audit('update_setting', 'app_setting', key, { value });
  revalidatePath('/settings');
  return {};
}
