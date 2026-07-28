import { useMemo } from 'react';
import { currentUser } from '@/data/mock';
import { useAuth } from '@/store/auth';

/**
 * 「いまアプリを使っている人」を1か所で解決する。
 *
 * 実DB接続時はログイン中のプロフィール、モック時は従来の currentUser を返す。
 * 画面はこれだけを見ればよく、`currentUser` を直接 import しない。
 *
 * ★ id が本物の UUID になるので、所有判定（自分の出品かどうか）も
 *   実データで正しく動くようになる。
 */
export type Me = {
  id: string;
  nickname: string;
  /** URL 文字列 or ローカル画像（require の数値）。Avatar コンポーネントが両対応 */
  avatar: string | number;
  fertilizer: number;
  isPremium: boolean;
  /** 実DBのアカウントか（モックなら false） */
  live: boolean;
};

export function useMe(): Me {
  const { profile, live } = useAuth();

  return useMemo<Me>(() => {
    if (live && profile) {
      return {
        id: profile.id,
        nickname: profile.nickname,
        avatar: profile.avatarUrl ?? '',
        fertilizer: profile.fertilizer,
        isPremium: profile.isPremium,
        live: true,
      };
    }
    return {
      id: currentUser.id,
      nickname: currentUser.nickname,
      avatar: currentUser.avatar,
      fertilizer: currentUser.fertilizer,
      isPremium: false,
      live: false,
    };
  }, [live, profile]);
}
