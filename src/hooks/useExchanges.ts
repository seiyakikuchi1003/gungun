import { useCallback, useEffect, useState } from 'react';
import { trades as mockTrades, tradeItem, tradeUser, chatByTrade, type Trade } from '@/data/mockSocial';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useMe } from '@/store/me';
import * as api from '@/lib/api/exchanges';

/**
 * 玉突き交換（取引）。
 *
 * 実DB接続時は `exchanges` / `messages` / `ratings` を読み書きする。
 * 未接続時は従来のモック（mockSocial の trades / chatByTrade）。
 *
 * 画面は Trade 型のまま使えるよう詰め替える。実DBでは商品名・相手の名前を
 * 行が持っているので、mock の tradeItem()/tradeUser() は使わない。
 */
export type UITrade = Trade & {
  /** system メッセージ用（モックの ChatMsg と揃える） */
  itemName: string;
  itemImage: string | null;
  partnerName: string;
  partnerAvatar: string | number;
  /** 自分が送る側か */
  iAmSender: boolean;
};

export type UIMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  /** 「収穫が成立しました」などの案内行（モック互換） */
  system?: boolean;
};

function toUITrade(e: api.Exchange): UITrade {
  return {
    id: e.id,
    itemId: e.itemId,
    counterpartId: e.iAmSender ? e.toUserId : e.fromUserId,
    dir: e.iAmSender ? 'send' : 'receive',
    status: e.status,
    shippedAt: undefined,
    itemName: e.itemName,
    itemImage: e.itemImage,
    partnerName: e.partnerName,
    partnerAvatar: e.partnerAvatar ?? '',
    iAmSender: e.iAmSender,
  };
}

/** モックの取引に、商品名・相手名を添える */
function mockToUITrade(t: Trade): UITrade {
  const item = tradeItem(t);
  const user = tradeUser(t);
  return {
    ...t,
    itemName: item?.name ?? '',
    itemImage: item?.image ?? null,
    partnerName: user?.nickname ?? '',
    partnerAvatar: user?.avatar ?? '',
    iAmSender: t.dir === 'send',
  };
}

export function useExchanges() {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [list, setList] = useState<UITrade[]>([]);
  const [loading, setLoading] = useState(live);

  const load = useCallback(async () => {
    if (!live) {
      setList(mockTrades.map(mockToUITrade));
      setLoading(false);
      return;
    }
    if (!me.live) { setList([]); setLoading(false); return; }
    try {
      setList((await api.fetchMyExchanges(me.id)).map(toUITrade));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [live, me.live, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { list, loading, reload: load };
}

/** 取引1件＋チャット */
export function useExchange(exchangeId: string) {
  const live = isSupabaseEnabled;
  const me = useMe();
  const [trade, setTrade] = useState<UITrade | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(live);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!live) {
      const t = mockTrades.find((x) => x.id === exchangeId) ?? null;
      setTrade(t ? mockToUITrade(t) : null);
      setMessages(
        (chatByTrade[exchangeId] ?? []).map((m) => ({
          id: m.id,
          body: m.body,
          mine: m.mine,
          createdAt: m.time,
          system: m.system,
        }))
      );
      setLoading(false);
      return;
    }
    if (!me.live) { setLoading(false); return; }
    try {
      const [e, ms] = await Promise.all([
        api.fetchExchange(exchangeId, me.id),
        api.fetchMessages(exchangeId, me.id),
      ]);
      setTrade(e ? toUITrade(e) : null);
      setMessages(ms.map((m) => ({ id: m.id, body: m.body, mine: m.mine, createdAt: m.createdAt })));
    } catch (e) {
      setError(e instanceof Error ? e.message : '取引を読み込めませんでした');
    } finally {
      setLoading(false);
    }
  }, [live, exchangeId, me.live, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text) return;
      if (!live) {
        setMessages((l) => [...l, { id: `m-${Date.now()}`, body: text, mine: true, createdAt: 'たった今' }]);
        return;
      }
      if (!me.live) return;
      // 先に画面へ出してから送る（チャットは待たされると気持ち悪いため）
      const tmp: UIMessage = { id: `tmp-${Date.now()}`, body: text, mine: true, createdAt: 'たった今' };
      setMessages((l) => [...l, tmp]);
      try {
        await api.sendMessage(exchangeId, me.id, text);
        await load();
      } catch {
        setMessages((l) => l.filter((m) => m.id !== tmp.id));
        setError('メッセージを送れませんでした');
      }
    },
    [live, exchangeId, me.live, me.id, load]
  );

  const markShipped = useCallback(async (): Promise<{ error: string | null }> => {
    if (!live) { setTrade((t) => (t ? { ...t, status: 'shipped' } : t)); return { error: null }; }
    setBusy(true);
    try {
      await api.ship(exchangeId);
      await load();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '発送を記録できませんでした' };
    } finally {
      setBusy(false);
    }
  }, [live, exchangeId, load]);

  const markReceived = useCallback(async (): Promise<{ error: string | null }> => {
    if (!live) { setTrade((t) => (t ? { ...t, status: 'received' } : t)); return { error: null }; }
    setBusy(true);
    try {
      await api.receive(exchangeId);
      await load();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '受取を記録できませんでした' };
    } finally {
      setBusy(false);
    }
  }, [live, exchangeId, load]);

  const rate = useCallback(
    async (score: number, comment: string): Promise<{ error: string | null }> => {
      if (!live) return { error: null };
      setBusy(true);
      try {
        await api.submitRating(exchangeId, score, comment);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : '評価を送れませんでした' };
      } finally {
        setBusy(false);
      }
    },
    [live, exchangeId]
  );

  return { trade, messages, loading, busy, error, reload: load, send, markShipped, markReceived, rate };
}
