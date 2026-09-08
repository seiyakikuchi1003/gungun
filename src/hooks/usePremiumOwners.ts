import { useEffect, useState } from 'react';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

/**
 * プレミアム会員のユーザーID一覧（2026-08-21 指摘）。
 *
 * ホームの「おすすめ」が「最近見た区分に近い順」だったため、
 * 何を基準にしているのか伝わらないという指摘があった。
 * 「おすすめ＝プレミアムに登録している人の商品が優先」という
 * 説明できる基準に変えるため、その判定材料をここで持つ。
 *
 * profiles.is_premium は anon でもそのまま読めるので、
 * ビューを作り替えずに済ませている。人数ぶんの ID しか取らないため軽い。
 */
export function usePremiumOwners(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    let alive = true;
    supabase
      .from('profiles')
      .select('id')
      .eq('is_premium', true)
      .then(({ data, error }) => {
        // 取れなくても並びが既定に戻るだけなので、画面は止めない
        if (!alive || error || !data) return;
        setIds(new Set(data.map((r: { id: string }) => r.id)));
      });
    return () => { alive = false; };
  }, []);

  return ids;
}
