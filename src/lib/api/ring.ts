import { requireSupabase } from '@/lib/supabase';

/**
 * 収穫でできた「玉突きの輪」。お祝い画面（項目9）で使う。
 *
 * exchanges は RLS で当事者のぶんしか読めないので、輪の全体は
 * harvest_ring RPC（SECURITY DEFINER）から取る。参加者以外には空が返る。
 */

export type RingStep = {
  /** 輪の中の順番（0始まり） */
  position: number;
  exchangeId: string;
  itemId: string;
  itemName: string;
  itemImage: string | null;
  /** 渡した人 */
  giverId: string;
  giverName: string;
  giverAvatar: string | null;
  /** 受け取った人 */
  receiverId: string;
  receiverName: string;
  receiverAvatar: string | null;
  received: boolean;
};

type Row = {
  ring_position: number;
  exchange_id: string;
  status: string;
  item_id: string;
  item_name: string;
  item_image: string | null;
  giver_id: string;
  giver_name: string;
  giver_avatar: string | null;
  receiver_id: string;
  receiver_name: string;
  receiver_avatar: string | null;
};

export async function fetchHarvestRing(harvestId: string): Promise<RingStep[]> {
  const { data, error } = await requireSupabase().rpc('harvest_ring', { p_harvest_id: harvestId });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    position: Number(r.ring_position ?? 0),
    exchangeId: r.exchange_id,
    itemId: r.item_id,
    itemName: r.item_name,
    itemImage: r.item_image,
    giverId: r.giver_id,
    giverName: r.giver_name,
    giverAvatar: r.giver_avatar,
    receiverId: r.receiver_id,
    receiverName: r.receiver_name,
    receiverAvatar: r.receiver_avatar,
    received: r.status === 'received',
  }));
}
