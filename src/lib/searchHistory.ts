import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 検索履歴（端末に保存）。
 *
 * 何を探したかは個人の行動記録なので、サーバーには送らず端末だけに持つ。
 * 直近10件・重複なし・新しい順。
 */
const KEY = 'gungun.searchHistory';
const MAX = 10;

export async function loadSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export async function pushSearchHistory(word: string): Promise<string[]> {
  const w = word.trim();
  if (!w) return loadSearchHistory();
  const cur = await loadSearchHistory();
  const next = [w, ...cur.filter((x) => x !== w)].slice(0, MAX);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても検索自体は動く
  }
  return next;
}

export async function removeSearchHistory(word: string): Promise<string[]> {
  const next = (await loadSearchHistory()).filter((x) => x !== word);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 同上
  }
  return next;
}

export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
