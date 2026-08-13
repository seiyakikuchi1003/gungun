import { requireSupabase } from '@/lib/supabase';
import type { ExchangeStatus } from '@/lib/exchangeStatus';

/**
 * 取引詳細（2026-08-13 項目8）。
 *
 * 画面に必要なものを exchange_detail RPC から1往復で取る。
 * 住所は RLS で本人しか読めないので、この RPC 経由でしか手に入らない。
 */

export type ShipAddress = {
  name: string;
  phone: string;
  postal: string;
  address: string;
};

export type ExchangeDetail = {
  exchangeId: string;
  harvestId: string;
  status: ExchangeStatus;
  iAmSender: boolean;
  shippedAt: string | null;
  receivedAt: string | null;

  itemId: string;
  itemName: string;
  itemCondition: string;
  itemImage: string | null;

  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;

  /** 宛先。発送する側にだけ入る */
  shipTo: ShipAddress | null;
  /** 自分の住所。未登録なら null＝発送に進めない */
  myAddress: ShipAddress | null;

  iRated: boolean;
  partnerRated: boolean;
};

type Row = {
  exchange_id: string;
  harvest_id: string;
  status: ExchangeStatus;
  i_am_sender: boolean;
  shipped_at: string | null;
  received_at: string | null;
  item_id: string;
  item_name: string;
  item_condition: string;
  item_image: string | null;
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  ship_to_name: string | null;
  ship_to_phone: string | null;
  ship_to_postal: string | null;
  ship_to_address: string | null;
  my_name: string | null;
  my_phone: string | null;
  my_postal: string | null;
  my_address: string | null;
  i_rated: boolean;
  partner_rated: boolean;
};

function toAddress(
  name: string | null, phone: string | null, postal: string | null, address: string | null
): ShipAddress | null {
  // 住所が1行でも欠けていたら「未登録」として扱う（中途半端な宛先で送らせない）
  if (!name?.trim() || !postal?.trim() || !address?.trim()) return null;
  return { name, phone: phone ?? '', postal, address };
}

export async function fetchExchangeDetail(exchangeId: string): Promise<ExchangeDetail | null> {
  const { data, error } = await requireSupabase().rpc('exchange_detail', { p_exchange_id: exchangeId });
  if (error) throw error;
  const r = (data as Row[] | null)?.[0];
  if (!r) return null;
  return {
    exchangeId: r.exchange_id,
    harvestId: r.harvest_id,
    status: r.status,
    iAmSender: r.i_am_sender,
    shippedAt: r.shipped_at,
    receivedAt: r.received_at,
    itemId: r.item_id,
    itemName: r.item_name,
    itemCondition: r.item_condition,
    itemImage: r.item_image,
    partnerId: r.partner_id,
    partnerName: r.partner_name || '相手',
    partnerAvatar: r.partner_avatar,
    shipTo: toAddress(r.ship_to_name, r.ship_to_phone, r.ship_to_postal, r.ship_to_address),
    myAddress: toAddress(r.my_name, r.my_phone, r.my_postal, r.my_address),
    iRated: r.i_rated,
    partnerRated: r.partner_rated,
  };
}
