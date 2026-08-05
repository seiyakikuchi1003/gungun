import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * 画面を最新に保つための自動更新。
 *
 * 【なぜ必要か】
 *   これまでは最初に開いたときしか取りに行っていなかったため、
 *   他の人の水やり・届いたメッセージ・増えた肥料が、
 *   アプリを開き直すまで反映されなかった（2026-08-05 修正）。
 *
 * 【いつ取り直すか】
 *   1. その画面に戻ってきたとき（タブの切り替え・前の画面から戻る）
 *   2. アプリを前面に戻したとき（別アプリやブラウザから帰ってきたとき）
 *   3. 画面を開いている間の一定間隔（省略可）
 *
 * 【連打を防ぐ】
 *   短時間に何度も呼ばれるので、最後の取得から MIN_INTERVAL 以内は無視する。
 *   ただし決済から戻った直後などは待たせたくないので、間隔は短めにしてある。
 */

/** これ以内に取り直していたら省略する（ミリ秒） */
const MIN_INTERVAL = 3000;

type Options = {
  /** 画面を開いている間、この間隔でも取り直す（ミリ秒）。0 で無効 */
  intervalMs?: number;
  /** false の間は何もしない（未ログインなど） */
  enabled?: boolean;
};

export function useAutoRefresh(refresh: () => void | Promise<void>, options: Options = {}) {
  const { intervalMs = 0, enabled = true } = options;

  // 最新の関数を参照する。依存配列に入れると毎回購読し直しになるため
  const fnRef = useRef(refresh);
  fnRef.current = refresh;
  const lastRun = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const run = useRef((force = false) => {
    if (!enabledRef.current) return;
    const now = Date.now();
    if (!force && now - lastRun.current < MIN_INTERVAL) return;
    lastRun.current = now;
    Promise.resolve(fnRef.current()).catch(() => {
      // 取得に失敗しても画面は保つ（オフラインでも操作を止めない）
    });
  }).current;

  // 1. 画面に戻ってきたとき
  useFocusEffect(
    useRef(() => {
      run();
    }).current
  );

  // 2. アプリを前面に戻したとき
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, [run]);

  // 3. 開いている間の定期取得
  useEffect(() => {
    if (!intervalMs) return;
    const id = setInterval(() => run(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, run]);
}
