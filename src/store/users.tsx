import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { getUser, type MockUser } from '@/data/mock';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { fetchProfilesByIds } from '@/lib/api/profile';
import { DELETED_USER_NAME } from '@/lib/api/map';

/**
 * ユーザー（ニックネーム・アイコン）を id から引く。
 *
 * ★ なぜ必要か
 *   実DB接続前は `getUser()`（モック）で名前を引いていた。実データでは id が
 *   UUID になるためモックに当たらず、全部「名無し」＋アイコン空欄になっていた
 *   （2026-08-04 実機で発覚）。通知・コメント・ブロック一覧など、行そのものに
 *   名前が入っていない画面すべてが該当する。
 *
 * ★ 仕組み
 *   `user(id)` は同期関数（`.map()` の中からも呼べる）。キャッシュに無ければ
 *   id を控えて次のフレームでまとめて1回だけ取りに行く（N+1 を避ける）。
 *   取得できなかった id は「退会したユーザー」として扱う。
 */
export type UsersState = {
  /** 同期でユーザーを返す。未取得なら仮の値を返し、裏で取りに行く */
  user: (id: string | null | undefined) => MockUser;
  /** 先に読み込んでおきたいとき（一覧を取った直後など） */
  prefetch: (ids: (string | null | undefined)[]) => void;
};

const UsersContext = createContext<UsersState | null>(null);

const PLACEHOLDER: Omit<MockUser, 'id'> = { nickname: '', avatar: '', ratingAvg: null, ratingCount: 0, itemCount: 0 };
const DELETED: Omit<MockUser, 'id'> = { nickname: DELETED_USER_NAME, avatar: '', ratingAvg: null, ratingCount: 0, itemCount: 0 };

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const { live } = useAuth();
  const useDb = isSupabaseEnabled && live;

  const [cache, setCache] = useState<Record<string, MockUser>>({});
  // 取りに行く予定の id。描画中に足すので state ではなく ref に置く
  const pending = useRef<Set<string>>(new Set());
  // 取得済み（見つからなかったものも含む）。同じ id を無限に引き直さないため
  const asked = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const ids = [...pending.current];
    pending.current.clear();
    if (!ids.length) return;
    ids.forEach((id) => asked.current.add(id));
    try {
      const found = await fetchProfilesByIds(ids);
      setCache((prev) => {
        const next = { ...prev };
        for (const p of found) {
          next[p.id] = {
            id: p.id,
            nickname: p.nickname,
            avatar: p.avatarUrl ?? '',
            ratingAvg: p.ratingAvg,
            ratingCount: p.ratingCount,
            itemCount: p.itemCount,
          };
        }
        // 見つからなかった＝退会済み。毎回引き直さないようここで確定させる
        for (const id of ids) if (!next[id]) next[id] = { id, ...DELETED };
        return next;
      });
    } catch {
      // 取れなくても画面は動かす。次のマウントで再挑戦できるよう asked から戻す
      ids.forEach((id) => asked.current.delete(id));
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { flush(); }, 0);
  }, [flush]);

  const want = useCallback(
    (id: string) => {
      if (!useDb || asked.current.has(id) || pending.current.has(id)) return;
      pending.current.add(id);
      schedule();
    },
    [useDb, schedule]
  );

  const prefetch = useCallback(
    (ids: (string | null | undefined)[]) => {
      for (const id of ids) if (id) want(id);
    },
    [want]
  );

  const user = useCallback(
    (id: string | null | undefined): MockUser => {
      if (!id) return { id: '', ...DELETED };
      if (!useDb) return getUser(id);
      const hit = cache[id];
      if (hit) return hit;
      want(id);
      return { id, ...PLACEHOLDER };
    },
    [useDb, cache, want]
  );

  const value = useMemo<UsersState>(() => ({ user, prefetch }), [user, prefetch]);
  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers(): UsersState {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error('useUsers must be used within UsersProvider');
  return ctx;
}
