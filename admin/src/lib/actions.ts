'use server';

import { revalidatePath } from 'next/cache';
import { admin } from './supabase';

/** 運営操作を必ず監査ログに残す（引き継ぎ後も「誰が何をしたか」を追える） */
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
    // 監査ログの失敗で本処理を巻き戻さない（0004 未適用のローカル等）
  }
}

// ── ユーザー ───────────────────────────────────────────────

export async function setSuspended(userId: string, suspended: boolean, reason: string) {
  const { error } = await admin()
    .from('profiles')
    .update({ is_suspended: suspended, suspended_reason: suspended ? reason || null : null })
    .eq('id', userId);
  if (error) return { error: error.message };

  await audit(suspended ? 'suspend_user' : 'unsuspend_user', 'user', userId, { reason });
  revalidatePath('/users');
  return {};
}

/** 肥料の手動付与／減算。残高だけでなく台帳にも必ず記録する */
export async function grantFertilizer(userId: string, amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return { error: '増減量を入力してください' };

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
  revalidatePath('/users');
  return {};
}

// ── 商品 ───────────────────────────────────────────────────

/** 物理削除はしない（ツリーの整合性が壊れるため）。status を deleted にして非表示にする */
export async function softDeleteItem(itemId: string) {
  const { error } = await admin().from('items').update({ status: 'deleted' }).eq('id', itemId);
  if (error) return { error: error.message };

  await audit('delete_item', 'item', itemId);
  revalidatePath('/items');
  return {};
}

export async function restoreItem(itemId: string) {
  const { error } = await admin().from('items').update({ status: 'growing' }).eq('id', itemId);
  if (error) return { error: error.message };

  await audit('restore_item', 'item', itemId);
  revalidatePath('/items');
  return {};
}

// ── 通報 ───────────────────────────────────────────────────

export async function setReportStatus(reportId: string, status: 'open' | 'resolved' | 'dismissed', note: string) {
  const { error } = await admin()
    .from('reports')
    .update({
      status,
      handled_at: status === 'open' ? null : new Date().toISOString(),
      handled_note: note || null,
    })
    .eq('id', reportId);
  if (error) return { error: error.message };

  await audit('set_report_status', 'report', reportId, { status, note });
  revalidatePath('/reports');
  return {};
}

// ── アプリ設定 ─────────────────────────────────────────────

/**
 * app_settings は jsonb。管理画面からは文字列で受け取り、
 * 数値／真偽値として解釈できるものはその型で保存する（アプリ側が int を期待するため）。
 */
export async function saveSetting(key: string, raw: string) {
  const text = raw.trim();
  let value: unknown = text;
  if (/^-?\d+(\.\d+)?$/.test(text)) value = Number(text);
  else if (text === 'true' || text === 'false') value = text === 'true';

  const { error } = await admin()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return { error: error.message };

  await audit('update_setting', 'app_setting', key, { value });
  revalidatePath('/settings');
  return {};
}
