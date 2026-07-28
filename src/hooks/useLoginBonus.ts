import { useCallback, useEffect, useState } from 'react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useMe } from '@/store/me';
import { useTree } from '@/store/tree';
import * as api from '@/lib/api/profile';

/**
 * ログインボーナス（1日1回）。
 *
 * 「今日もう受け取ったか」の判定は DB（profiles.last_login_bonus_on）が持つ。
 * アプリを消して入れ直しても二重取りできない。
 * 未接続時は画面内の一時stateだけで動く（プレビュー用）。
 */
export function useLoginBonus() {
  const live = isSupabaseEnabled;
  const me = useMe();
  const { reloadProfile } = useAuth();
  const { settings } = useTree();
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(settings.dailyLoginBonus);

  useEffect(() => {
    setAmount(settings.dailyLoginBonus);
  }, [settings.dailyLoginBonus]);

  // 起動時に「今日受け取れるか」を確認する
  useEffect(() => {
    if (!live || !me.live) return;
    let alive = true;
    api
      .canClaimLoginBonus()
      .then((can) => { if (alive) setClaimed(!can); })
      .catch(() => {});
    return () => { alive = false; };
  }, [live, me.live]);

  const claim = useCallback(async (): Promise<{ amount: number; error: string | null }> => {
    if (claimed || busy) return { amount: 0, error: null };
    if (!live || !me.live) {
      setClaimed(true);
      return { amount, error: null };
    }
    setBusy(true);
    try {
      const got = await api.claimLoginBonus();
      setClaimed(true);
      if (got > 0) setAmount(got);
      await reloadProfile(); // 肥料残高を画面に反映
      return { amount: got, error: null };
    } catch (e) {
      return { amount: 0, error: e instanceof Error ? e.message : '受け取れませんでした' };
    } finally {
      setBusy(false);
    }
  }, [claimed, busy, live, me.live, amount, reloadProfile]);

  return { claimed, busy, amount, claim };
}
