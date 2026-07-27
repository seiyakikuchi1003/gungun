import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  items as seedPool,
  ancestorsOf,
  childrenOf,
  treeItems,
  currentUser,
  MockItem,
} from '@/data/mock';
import { settings } from '@/config/settings';

/**
 * ツリー（森）ストア — モック版。
 *
 * ★ここが今回の修正の核心。
 * 「水やり = 対象を選ぶ + 自分の商品を1つ出品する」。water() を呼ぶと items に
 * 新しい商品（子ノード）が作られ、対象商品にぶら下がる。肥料も消費する。
 *
 * ネイティブ化時：この water() をそのまま Supabase の `water` RPC 呼び出しに
 * 差し替える（ツリーの親子付け＝parent_id/root_id/depth の確定は DB 関数側で行う）。
 * ここではモックのため、同じ契約でクライアント状態を更新している。
 */

export type WaterInput = {
  name: string;
  category: string;
  condition: string;
  description: string;
  photos: string[]; // 1枚目がサムネイル
};

export type CanWater =
  | { ok: true }
  | { ok: false; reason: string };

/** 出品編集の入力（種植え・水やり共通のフォーム項目） */
export type EditInput = {
  name: string;
  category: string;
  condition: string;
  description: string;
  photos: string[];
};

type TreeState = {
  items: MockItem[];
  fertilizer: number;
  /** 水やり可否（SPEC 3-2 can_water 相当） */
  canWater: (targetId: string) => CanWater;
  /** 水やり実行＝子ノードを作成して返す（RPC 相当） */
  water: (targetId: string, input: WaterInput) => MockItem | null;
  /** 出品内容の編集（自分の商品のみ） */
  updateItem: (id: string, input: EditInput) => void;
  /** 出品の削除。子ノードは新しい種として独立する（SPEC 3-3 detach_children 相当） */
  deleteItem: (id: string) => void;
  /** 直近に自分が水やりで出した商品ID（完了画面のハイライト用） */
  lastWateredId: string | null;
  getItem: (id: string) => MockItem | undefined;
  childrenOf: (id: string) => MockItem[];
  treeItems: (rootId: string) => MockItem[];
  ancestorsOf: (id: string) => MockItem[];
};

/**
 * parentId ポインタから rootId / depth を再計算する（森全体）。
 * 親が存在しない（削除された・切り離された）ノードは自分自身が root になる。
 * SPEC 3-3 の「子孫の root_id / depth 付け替え」をクライアント側で再現。
 */
function recomputeTree(pool: MockItem[]): MockItem[] {
  const byId = new Map(pool.map((i) => [i.id, i]));
  return pool.map((i) => {
    let cur = i;
    let depth = 0;
    let guard = 0;
    while (cur.parentId && byId.has(cur.parentId) && guard < 128) {
      cur = byId.get(cur.parentId)!;
      depth += 1;
      guard += 1;
    }
    if (i.rootId === cur.id && i.depth === depth) return i;
    return { ...i, rootId: cur.id, depth };
  });
}

const TreeContext = createContext<TreeState | null>(null);

let seq = 0;
function newId() {
  seq += 1;
  return `w-new-${seq}`;
}

export function TreeProvider({ children }: { children: React.ReactNode }) {
  const [pool, setPool] = useState<MockItem[]>(() => [...seedPool]);
  const [fertilizer, setFertilizer] = useState<number>(currentUser.fertilizer);
  const [lastWateredId, setLastWateredId] = useState<string | null>(null);

  const canWater = useCallback(
    (targetId: string): CanWater => {
      const target = pool.find((i) => i.id === targetId);
      if (!target) return { ok: false, reason: '商品が見つかりません' };
      if (target.status !== 'growing')
        return { ok: false, reason: 'この商品は取引中のため水やりできません' };
      // 祖先ライン（target〜root）に自分の商品があれば不可（SPEC 3-2）
      const line = ancestorsOf(pool, targetId);
      if (line.some((n) => n.ownerId === currentUser.id)) {
        if (target.ownerId === currentUser.id)
          return { ok: false, reason: '自分の出品には水やりできません' };
        return { ok: false, reason: 'すでに参加している交換の輪には水やりできません' };
      }
      if (fertilizer < settings.waterCost)
        return { ok: false, reason: '肥料が不足しています' };
      return { ok: true };
    },
    [pool, fertilizer]
  );

  const water = useCallback(
    (targetId: string, input: WaterInput): MockItem | null => {
      const target = pool.find((i) => i.id === targetId);
      if (!target) return null;
      const gate = canWater(targetId);
      if (!gate.ok) return null;

      // 子ノードとして新しい商品を作成（＝出品）。SPEC 2-2 の水やりデータ。
      const child: MockItem = {
        id: newId(),
        name: input.name.trim() || '無題の商品',
        category: input.category,
        condition: input.condition,
        description: input.description.trim(),
        image: input.photos[0] ?? '',
        images: input.photos,
        localImages: undefined,
        ownerId: currentUser.id,
        waterCount: 0,
        likeCount: 0,
        treeCount: 0,
        status: 'growing',
        parentId: target.id,
        rootId: target.rootId, // 対象と同じ木に所属
        depth: target.depth + 1,
      };

      setPool((prev) =>
        prev
          .map((i) => (i.id === target.id ? { ...i, waterCount: i.waterCount + 1 } : i))
          .concat(child)
      );
      // 肥料を消費（fertilizer_ledger の負記録に相当。金額は設定から）
      setFertilizer((f) => f - settings.waterCost);
      setLastWateredId(child.id);
      // （モック）対象出品者への「水やりされました」通知はここで送信される想定。
      return child;
    },
    [pool, canWater]
  );

  const updateItem = useCallback((id: string, input: EditInput) => {
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
              // ローカル画像は編集で差し替えたらクリア（URIベースに寄せる）
              localImages: input.photos.length ? undefined : i.localImages,
            }
          : i
      )
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setPool((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;
      let next = prev.map((i) =>
        // 直接の子を切り離す（新しい種として独立させる準備）
        i.parentId === id ? { ...i, parentId: null } : i
      );
      // 親の水やり数を1つ戻す（水やりで出した子だった場合）
      if (target.parentId) {
        next = next.map((i) =>
          i.id === target.parentId ? { ...i, waterCount: Math.max(0, i.waterCount - 1) } : i
        );
      }
      // 対象を削除
      next = next.filter((i) => i.id !== id);
      // 子孫の root_id / depth を再計算
      return recomputeTree(next);
    });
  }, []);

  const value = useMemo<TreeState>(
    () => ({
      items: pool,
      fertilizer,
      canWater,
      water,
      updateItem,
      deleteItem,
      lastWateredId,
      getItem: (id) => pool.find((i) => i.id === id),
      childrenOf: (id) => childrenOf(pool, id),
      treeItems: (rootId) => treeItems(pool, rootId),
      ancestorsOf: (id) => ancestorsOf(pool, id),
    }),
    [pool, fertilizer, canWater, water, updateItem, deleteItem, lastWateredId]
  );

  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

export function useTree(): TreeState {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTree must be used within TreeProvider');
  return ctx;
}
