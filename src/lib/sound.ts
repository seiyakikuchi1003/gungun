import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * 効果音ヘルパー（expo-audio）。
 * 音源はプレビュー配信サイト（Cloudflare Pages）上の小さなWAVを使用。
 * ネイティブ化の際はアプリ内アセット（require）に差し替える想定。
 * 失敗しても無視（オフライン・サイレント時などで落とさない）。
 */

const BASE = 'https://gungun-preview.pages.dev/sounds';

export type SfxName = 'pop' | 'chime' | 'stamp';

const players: Partial<Record<SfxName, AudioPlayer>> = {};

function get(name: SfxName): AudioPlayer | null {
  try {
    if (!players[name]) {
      const p = createAudioPlayer({ uri: `${BASE}/${name}.wav` });
      p.volume = 0.5;
      players[name] = p;
    }
    return players[name]!;
  } catch {
    return null;
  }
}

/** 事前ロード（ホーム表示時などに呼ぶと初回再生の遅延が減る） */
export function preloadSfx() {
  (['pop', 'chime', 'stamp'] as SfxName[]).forEach(get);
}

/**
 * 効果音を再生。
 *  - pop   … 引っ張って更新の完了「プチッ」
 *  - chime … 水やり成立「ピロン↑」
 *  - stamp … スタンプ着地「ポンッ」
 */
export function playSfx(name: SfxName) {
  try {
    const p = get(name);
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch {}
}
