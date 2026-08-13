import { requireSupabase } from '@/lib/supabase';
import { relativeTime, DELETED_USER_NAME, displayName } from './map';
import type { ExchangeStatus } from '@/types/db';

/** 玉突き交換（発送・受取・メッセージ・評価）。 */

export type Exchange = {
  id: string;
  harvestId: string;
  itemId: string;
  itemName: string;
  itemImage: string | null;
  fromUserId: string;
  toUserId: string;
  /** 相手（自分がどちら側かで切り替えた表示用） */
  partnerName: string;
  partnerAvatar: string | null;
  /** 自分は送る側か（false なら受け取る側） */
  iAmSender: boolean;
  status: ExchangeStatus;
  position: number;
  createdAt: string;
};

export type ExchangeMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

const COLUMNS =
  'id, harvest_id, item_id, from_user_id, to_user_id, status, position, ' +
  'items(name, item_images(url, sort_order)), ' +
  'sender:profiles!exchanges_from_user_id_fkey(nickname, avatar_url), ' +
  'receiver:profiles!exchanges_to_user_id_fkey(nickname, avatar_url), ' +
  'harvests(created_at)';

function toExchange(r: any, me: string): Exchange {
  const iAmSender = r.from_user_id === me;
  const partner = iAmSender ? r.receiver : r.sender;
  const images: { url: string; sort_order: number }[] = r.items?.item_images ?? [];
  const thumb = [...images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
  return {
    id: r.id,
    harvestId: r.harvest_id,
    itemId: r.item_id,
    itemName: r.items?.name ?? '',
    itemImage: thumb,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    partnerName: displayName(partner?.nickname),
    partnerAvatar: partner?.avatar_url ?? null,
    iAmSender,
    status: r.status,
    position: Number(r.position ?? 0),
    createdAt: r.harvests?.created_at ? relativeTime(r.harvests.created_at) : '',
  };
}

/** 自分が関わっている取引すべて（RLS で当事者のみに絞られる） */
export async function fetchMyExchanges(userId: string): Promise<Exchange[]> {
  const { data, error } = await requireSupabase()
    .from('exchanges')
    .select(COLUMNS)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toExchange(r, userId));
}

export async function fetchExchange(id: string, userId: string): Promise<Exchange | null> {
  const { data, error } = await requireSupabase()
    .from('exchanges')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toExchange(data, userId) : null;
}

export async function ship(exchangeId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('ship_exchange', { p_exchange_id: exchangeId });
  if (error) throw error;
}

export async function receive(exchangeId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('receive_exchange', { p_exchange_id: exchangeId });
  if (error) throw error;
}

// ── メッセージ ─────────────────────────────────────────────

export async function fetchMessages(exchangeId: string, me: string): Promise<ExchangeMessage[]> {
  const { data, error } = await requireSupabase()
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('exchange_id', exchangeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: relativeTime(r.created_at),
    mine: r.sender_id === me,
  }));
}

export async function sendMessage(
  exchangeId: string,
  senderId: string,
  body: string
): Promise<void> {
  const { error } = await requireSupabase()
    .from('messages')
    .insert({ exchange_id: exchangeId, sender_id: senderId, body: body.trim() });
  if (error) throw error;
}

// ── 評価 ───────────────────────────────────────────────────

export async function submitRating(
  exchangeId: string,
  score: number,
  comment: string
): Promise<void> {
  const { error } = await requireSupabase().rpc('submit_rating', {
    p_exchange_id: exchangeId,
    p_score: score,
    p_comment: comment,
  });
  if (error) throw error;
}

/** すでに評価済みか（画面のボタン制御用） */
export async function hasRated(exchangeId: string, userId: string): Promise<boolean> {
  const { count, error } = await requireSupabase()
    .from('ratings')
    .select('id', { count: 'exact', head: true })
    .eq('exchange_id', exchangeId)
    .eq('rater_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
