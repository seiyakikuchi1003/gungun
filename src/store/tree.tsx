import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  items as seedPool,
  ancestorsOf as ancestorsIn,
  childrenOf as childrenIn,
  treeItems as treeItemsIn,
  currentUser,
  MockItem,
} from '@/data/mock';
import { settings as fallbackSettings } from '@/config/settings';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import * as api from '@/lib/api/items';
import { uploadImages } from '@/lib/api/storage';
import { fetchSettings, defaultSettings, type AppSettings } from '@/lib/api/settings';

/**
 * ツリー（森）ストア。
 *
 * .env に Supabase の接続情報があれば **実DB**、無ければモックで動く。
 * 画面から見た使い方は同じ（`items` に森が入り、`water()` などを呼ぶ）。
 *
 * 設計：
 *  - 親子付け（parent_id / root_id / depth）・肥料の増減・通知は **DB の RPC が確定**する。
 *    ここは呼んで読み直すだけ。アプリ側で計算しない。
 *  - `canWater()` は画面の即時表示のためにクライアント側で判定するが、
 *    **本当の可否は DB 側が再判定する**（ここを通らなくても書き込めない）。
 */

export type WaterInput = {
  name: string;
  category: string;
  condition: string;
  description: string;
  photos: string[]; // 1枚目がサムネイル。端末のローカルURIでもよい（自動でアップロード）
};

export type CanWater = { ok: true } | { ok: false; reason: string };

/** 出品編集の入力（種植え・水やり共通のフォーム項目） */
export type EditInput = WaterInput;

/** 書き込み系の結果。error が null なら成功 */
export type WriteResult = { error: string | null };

type TreeState = {
  items: MockItem[];
  fertilizer: number;
  /** 実DB接続なら true */
  live: boolean;
  /** 初回読み込み中 */
  loading: boolean;
  /** 読み込みエラー（画面に出す用） */
  error: string | null;
  /** アプリ設定（水やり単価など。DBから読む） */
  settings: AppSettings;

  /** 一覧を取り直す（pull-to-refresh・書き込み後） */
  refresh: () => Promise<void>;

  /** 水やり可否（SPEC 3-2 can_water 相当。表示用の事前判定） */
  canWater: (targetId: string) => CanWater;
  /** 種を植える（出品） */
  plantSeed: (input: WaterInput) => Promise<WriteResult>;
  /** 水やり実行＝子ノードを作成 */
  water: (targetId: string, input: WaterInput) => Promise<MockItem | null>;
  /** 収穫。成功したら harvest の id */
  harvestSeed: (rootId: string, targetId: string) => Promise<{ id: string | null; error: string | null }>;
  updateItem: (id: string, input: EditInput) => Promise<WriteResult>;
  /** 出品の削除。子ノードは新しい種として独立する（SPEC 3-3） */
  deleteItem: (id: string) => Promise<WriteResult>;

  /**
   * 肥料を増やす（ログインボーナス・チャージ）。
   * 実DB接続時は残高をサーバが持つので、ここでは再読み込みだけ行う。
   */
  addFertilizer: (amount: number) => void;

  /** 直近に自分が水やりで出した商品ID（完了画面のハイライト用） */
  lastWateredId: string | null;
  getItem: (id: string) => MockItem | undefined;
  childrenOf: (id: string) => MockItem[];
  treeItems: (rootId: string) => MockItem[];
  ancestorsOf: (id: string) => MockItem[];
};

/**
 * parentId ポインタから rootId / depth / waterCount / treeCount を再計算する（モック用）。
 * 実DBではトリガと detach_children ＋ item_cards ビューが同じことをする。
 * 2026-07-28 MTG：目のアイコン＋数字は「子ノード数」に一致させる。
 */
function recomputeTree(pool: MockItem[]): MockItem[] {
  const byId = new Map(pool.map((i) => [i.id, i]));

  // 1) 各ノードの root/depth を親ポインタから確定
  const meta = new Map<string, { rootId: string; depth: number }>();
  for (const i of pool) {
    let cur = i;
    let depth = 0;
    let guard = 0;
    while (cur.parentId && byId.has(cur.parentId) && guard < 128) {
      cur = byId.get(cur.parentId)!;
      depth += 1;
      guard += 1;
    }
    meta.set(i.id, { rootId: cur.id, depth });
  }

  // 2) 子ノード数を集計（水やり数 = 直接の子）
  const childCount = new Map<string, number>();
  for (const i of pool) {
    if (i.parentId) childCount.set(i.parentId, (childCount.get(i.parentId) ?? 0) + 1);
  }
  // 3) 木の総数（同じ rootId のノード数）
  const treeSize = new Map<string, number>();
  for (const i of pool) {
    const r = meta.get(i.id)!.rootId;
    treeSize.set(r, (treeSize.get(r) ?? 0) + 1);
  }

  return pool.map((i) => {
    const m = meta.get(i.id)!;
    const wc = childCount.get(i.id) ?? 0;
    const tc = treeSize.get(m.rootId) ?? 1;
    if (i.rootId === m.rootId && i.depth === m.depth && i.waterCount === wc && i.treeCount === tc) return i;
    return { ...i, rootId: m.rootId, depth: m.depth, waterCount: wc, treeCount: tc };
  });
}

/** DB のエラーを画面に出せる日本語にする */
function jp(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/insufficient|肥料が足りません/.test(m)) return '肥料が足りません';
  if (/cannot water|水やりできません/.test(m)) return 'この商品には水やりできません';
  if (/already|duplicate|unique/i.test(m)) return 'すでに実行済みです';
  if (/fetch|network/i.test(m)) return '通信に失敗しました。電波の良い場所でお試しください';
  return m;
}

const TreeContext = createContext<TreeState | null>(null);

let seq = 0;
const newId = () => `w-new-${++seq}`;

export function TreeProvider({ children }: { children: React.ReactNode }) {
  const { profile, authed, reloadProfile } = useAuth();
  const live = isSupabaseEnabled;
  const myId = live ? (profile?.id ?? null) : currentUser.id;

  // モックの初期プールは waterCount / treeCount がデザイン用に手打ちされているため、
  // 実際の子ノード数と一致するよう再計算してから使う（2026-07-28 MTG）。
  const [pool, setPool] = useState<MockItem[]>(() => (live ? [] : recomputeTree([...seedPool])));
  const [mockFertilizer, setMockFertilizer] = useState<number>(currentUser.fertilizer);
  const [lastWateredId, setLastWateredId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(live);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const fertilizer = live ? (profile?.fertilizer ?? 0) : mockFertilizer;
  const waterCost = live ? settings.waterCost : fallbackSettings.waterCost;

  // ── 読み込み ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!live) return;
    try {
      const [items, s] = await Promise.all([api.fetchAllItems(), fetchSettings()]);
      setPool(items);
      setSettings(s);
      setError(null);
    } catch (e) {
      setError(jp(e));
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    if (!live) return;
    // ログイン前でも「みんなの種」は公開なので読める
    refresh();
  }, [live, authed, refresh]);

  // ── 水やり可否（表示用の事前判定）──────────────────────────
  const canWater = useCallback(
    (targetId: string): CanWater => {
      const target = pool.find((i) => i.id === targetId);
      if (!target) return { ok: false, reason: '商品が見つかりません' };
      if (target.status !== 'growing')
        return { ok: false, reason: 'この商品は取引中のため水やりできません' };
      if (!myId) return { ok: false, reason: 'ログインしてください' };

      // 対象が属する木（同じ rootId）に自分の商品が1つでもあれば不可（SPEC 3-2）。
      // 1ユーザーは1つの木につき1回だけ水やりできる。
      // サーバ側の can_water と同じ判定。ここは表示用の事前判定。
      // （サーバ側は status='deleted' を除外するが、プールには削除済みが入らないので
      //   ここでは絞り込み不要）
      const mineInTree = pool.filter((n) => n.rootId === target.rootId && n.ownerId === myId);
      if (mineInTree.length > 0) {
        if (target.ownerId === myId) return { ok: false, reason: '自分の出品には水やりできません' };
        // 「種を植えただけ」の人に「水やりしています」と出ていたので、理由を分ける
        const onlySeed = mineInTree.every((n) => n.parentId === null);
        return {
          ok: false,
          reason: onlySeed
            ? '自分のタネが育っている木です（1つの木につき1人1回まで）'
            : 'この木にはすでに水やりしています（1つの木につき1回まで）',
        };
      }
      if (fertilizer < waterCost) return { ok: false, reason: '肥料が不足しています' };
      return { ok: true };
    },
    [pool, myId, fertilizer, waterCost]
  );

  // ── 書き込み ─────────────────────────────────────────────

  /** 端末のローカル画像をアップロードしてURLにする（実DB接続時のみ） */
  const prepareImages = useCallback(
    async (photos: string[]): Promise<string[]> => {
      if (!live || !myId) return photos;
      return uploadImages(myId, photos);
    },
    [live, myId]
  );

  const plantSeed = useCallback(
    async (input: WaterInput): Promise<WriteResult> => {
      if (!live) {
        // モック：ローカルに種を1本足す
        const item: MockItem = {
          id: newId(),
          name: input.name.trim() || '無題の商品',
          category: input.category,
          condition: input.condition,
          description: input.description.trim(),
          image: input.photos[0] ?? '',
          images: input.photos,
          ownerId: currentUser.id,
          waterCount: 0,
          likeCount: 0,
          treeCount: 1,
          status: 'growing',
          parentId: null,
          rootId: '',
          depth: 0,
        };
        item.rootId = item.id;
        setPool((prev) => recomputeTree(prev.concat(item)));
        return { error: null };
      }
      if (!myId) return { error: 'ログインしてください' };
      try {
        const images = await prepareImages(input.photos);
        await api.plantSeed(myId, { ...input, images });
        await refresh();
        return { error: null };
      } catch (e) {
        return { error: jp(e) };
      }
    },
    [live, myId, prepareImages, refresh]
  );

  const water = useCallback(
    async (targetId: string, input: WaterInput): Promise<MockItem | null> => {
      const target = pool.find((i) => i.id === targetId);
      if (!target) return null;
      if (!canWater(targetId).ok) return null;

      if (!live) {
        const child: MockItem = {
          id: newId(),
          name: input.name.trim() || '無題の商品',
          category: input.category,
          condition: input.condition,
          description: input.description.trim(),
          image: input.photos[0] ?? '',
          images: input.photos,
          ownerId: currentUser.id,
          waterCount: 0,
          likeCount: 0,
          treeCount: 0,
          status: 'growing',
          parentId: target.id,
          rootId: target.rootId,
          depth: target.depth + 1,
        };
        setPool((prev) => recomputeTree(prev.concat(child)));
        setMockFertilizer((f) => f - fallbackSettings.waterCost);
        setLastWateredId(child.id);
        return child;
      }

      if (!myId) return null;
      try {
        const images = await prepareImages(input.photos);
        const newItemId = await api.water(myId, targetId, { ...input, images });
        setLastWateredId(newItemId);
        // 肥料が減るので profiles も読み直す
        await Promise.all([refresh(), reloadProfile()]);
        return (await api.fetchItem(newItemId)) ?? null;
      } catch (e) {
        setError(jp(e));
        return null;
      }
    },
    [pool, canWater, live, myId, prepareImages, refresh, reloadProfile]
  );

  const harvestSeed = useCallback(
    async (rootId: string, targetId: string) => {
      if (!live) {
        // モックでも「苗木機能」＝収穫パス外の枝を新しい種として独立させる
        // （2026-07-28 MTG）。DBの harvest_unchecked + detach_children と同じ挙動。
        setPool((prev) => {
          // root → target の一本道
          const byId = new Map(prev.map((i) => [i.id, i] as const));
          const path: string[] = [];
          let cur = byId.get(targetId);
          while (cur) {
            path.unshift(cur.id);
            cur = cur.parentId ? byId.get(cur.parentId) : undefined;
          }
          if (path[0] !== rootId) return prev;
          const pathSet = new Set(path);
          // パス上のノード以外で「親がパス上のもの」＝切り離される子 → parentId=null
          const next = prev.map((i) => {
            if (pathSet.has(i.id)) {
              // パス上は取引中に
              return { ...i, status: 'trading' as const };
            }
            if (i.parentId && pathSet.has(i.parentId)) {
              return { ...i, parentId: null };
            }
            return i;
          });
          return recomputeTree(next);
        });
        return { id: 'mock-harvest', error: null };
      }
      try {
        const id = await api.harvest(rootId, targetId);
        await refresh();
        return { id, error: null };
      } catch (e) {
        return { id: null, error: jp(e) };
      }
    },
    [live, refresh]
  );

  const updateItem = useCallback(
    async (id: string, input: EditInput): Promise<WriteResult> => {
      if (!live) {
        setPool((prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  name: input.name.trim() || i.name,
                  category: input.category,
                  condition: input.condition,
                  description: input.description.trim(),
                  image: input.photos[0] ?? i.image,
                  images: input.photos.length ? input.photos : i.images,
                  localImages: input.photos.length ? undefined : i.localImages,
                }
              : i
          )
        );
        return { error: null };
      }
      try {
        const images = await prepareImages(input.photos);
        await api.updateItem(id, { ...input, images });
        await refresh();
        return { error: null };
      } catch (e) {
        return { error: jp(e) };
      }
    },
    [live, prepareImages, refresh]
  );

  const deleteItem = useCallback(
    async (id: string): Promise<WriteResult> => {
      if (!live) {
        setPool((prev) => {
          const target = prev.find((i) => i.id === id);
          if (!target) return prev;
          // 子ノードは新しい種として独立させる（parentId=null）＝ SPEC 3-3 と同じ
          const next = prev
            .map((i) => (i.parentId === id ? { ...i, parentId: null } : i))
            .filter((i) => i.id !== id);
          return recomputeTree(next);
        });
        return { error: null };
      }
      try {
        await api.deleteItem(id);
        await refresh();
        return { error: null };
      } catch (e) {
        return { error: jp(e) };
      }
    },
    [live, refresh]
  );

  const addFertilizer = useCallback(
    (amount: number) => {
      if (amount <= 0) return;
      if (!live) {
        setMockFertilizer((f) => f + amount);
        return;
      }
      // 実DB接続時の残高はサーバ側で加算済みなので、読み直すだけ
      reloadProfile().catch(() => {});
    },
    [live, reloadProfile]
  );

  const value = useMemo<TreeState>(
    () => ({
      items: pool,
      fertilizer,
      live,
      loading,
      error,
      settings,
      refresh,
      canWater,
      plantSeed,
      water,
      harvestSeed,
      updateItem,
      deleteItem,
      addFertilizer,
      lastWateredId,
      getItem: (id) => pool.find((i) => i.id === id),
      childrenOf: (id) => childrenIn(pool, id),
      treeItems: (rootId) => treeItemsIn(pool, rootId),
      ancestorsOf: (id) => ancestorsIn(pool, id),
    }),
    [
      pool, fertilizer, live, loading, error, settings, refresh, canWater,
      plantSeed, water, harvestSeed, updateItem, deleteItem, addFertilizer, lastWateredId,
    ]
  );

  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

export function useTree(): TreeState {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTree must be used within TreeProvider');
  return ctx;
}
