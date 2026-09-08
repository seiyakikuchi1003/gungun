import { useEffect, useState } from 'react';
import { fetchPopularKeywords, type SearchScope } from '@/lib/api/search';

/**
 * 「人気のキーワード」「人気のタグ」（2026-08-21 指摘）。
 *
 * 実際に検索された回数の多い順に出す。
 * まだ検索ログが貯まっていないとき（＝公開直後や、
 * マイグレーションが当たる前）は、渡された既定の並びをそのまま使う。
 * 空の枠が出るより、何か押せるものが並んでいるほうがよいため。
 */
export function usePopularKeywords(fallback: string[], scope: SearchScope = 'item'): string[] {
  const [words, setWords] = useState<string[]>(fallback);

  useEffect(() => {
    let alive = true;
    fetchPopularKeywords(scope, fallback.length || 6).then((list) => {
      if (alive && list.length > 0) setWords(list);
    });
    return () => { alive = false; };
    // fallback は呼び出し側の定数なので、scope だけを見れば足りる
  }, [scope]);

  return words;
}
