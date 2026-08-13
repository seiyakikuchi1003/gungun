import { useCallback, useEffect, useState } from 'react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import { fetchExchangeDetail, type ExchangeDetail } from '@/lib/api/exchangeDetail';
import { ship, receive, submitRating } from '@/lib/api/exchanges';
import { errorMessage } from '@/lib/errorMessage';
import { trades as mockTrades, tradeItem, tradeUser } from '@/data/mockSocial';

/**
 * 取引詳細（2026-08-13 項目8）。
 *
 * 画面が必要とする情報と操作をここにまとめる。
 * 操作のあとは必ず取り直す（発送すると次にやることが変わるため）。
 */
export function useExchangeDetail(exchangeId: string) {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [detail, setDetail] = useState<ExchangeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!live || !me.live) {
      // モック（画面デモ）。実データが無くても取引詳細の見た目を確認できるようにする
      const t = mockTrades.find((x) => x.id === exchangeId);
      if (t) {
        const item = tradeItem(t);
        const user = tradeUser(t);
        setDetail({
          exchangeId: t.id,
          harvestId: '',
          status: t.status,
          iAmSender: t.dir === 'send',
          shippedAt: null,
          receivedAt: null,
          itemId: t.itemId,
          itemName: item?.name ?? '',
          itemCondition: item?.condition ?? '',
          itemImage: item?.image ?? null,
          partnerId: t.counterpartId,
          partnerName: user?.nickname ?? '相手',
          partnerAvatar: null,
          shipTo: null,
          myAddress: null,
          iRated: false,
          partnerRated: false,
        });
      } else {
        setDetail(null);
      }
      setLoading(false);
      return;
    }
    try {
      setDetail(await fetchExchangeDetail(exchangeId));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [live, me.live, exchangeId]);

  useEffect(() => { load(); }, [load]);

  /** 操作を1つの形にまとめる。失敗理由はサーバーの文言をそのまま返す */
  const run = useCallback(
    async (fn: () => Promise<void>, fallback: string): Promise<{ error: string | null }> => {
      if (!live) return { error: null };
      setBusy(true);
      try {
        await fn();
        await load();
        return { error: null };
      } catch (e) {
        return { error: errorMessage(e, fallback) };
      } finally {
        setBusy(false);
      }
    },
    [live, load]
  );

  return {
    detail,
    loading,
    busy,
    reload: load,
    markShipped: () => run(() => ship(exchangeId), '発送を記録できませんでした'),
    markReceived: () => run(() => receive(exchangeId), '受け取りを記録できませんでした'),
    rate: (score: number, comment: string) =>
      run(() => submitRating(exchangeId, score, comment), '評価を送れませんでした'),
  };
}
