import { useCallback, useRef, useState } from 'react';

/**
 * 送信の二度押しを止める。
 *
 * 【なぜ state だけでは足りないか】
 * `const [busy, setBusy] = useState(false)` と `if (busy) return` の組み合わせは、
 * React が描き直す前に2回目のタップが来ると素通りする。setBusy は非同期で、
 * 2回目のハンドラも「その回の描画時点の busy」＝ false を見るため。
 *
 * 実際に掲示板の投稿で、間を置かずに2回押すと同じ投稿が2件できていた
 * （2026-09-14、S-2）。ref は同期的に書き換わるので、ここで閉じる。
 *
 *   const { busy, run } = useSubmitGuard();
 *   <Button loading={busy} onPress={() => run(async () => { … })} />
 */
export function useSubmitGuard() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
