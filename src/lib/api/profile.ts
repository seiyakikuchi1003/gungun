import { requireSupabase } from '@/lib/supabase';

/** プロフィール・肥料・お届け先。 */

export type ProfileStats = {
  seedCount: number;
  waterCount: number;
  harvestCount: number;
  ratingAvg: number | null;
  ratingCount: number;
};

export type Address = {
  lastName: string;
  firstName: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  city: string;
  street: string;
  building: string;
};

export type PublicProfile = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
};

/**
 * id をまとめて渡してニックネーム・アイコンを引く（通知・コメント欄などで使う）。
 * 見つからない id は「退会済み」。呼び出し側（users ストア）でそう扱う。
 */
export async function fetchProfilesByIds(ids: string[]): Promise<PublicProfile[]> {
  if (!ids.length) return [];
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, nickname, avatar_url, bio')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    nickname: r.nickname,
    avatarUrl: r.avatar_url ?? null,
    bio: r.bio ?? null,
  }));
}

/** 他のユーザーのプロフィール1件（プロフィール画面用） */
export async function fetchPublicProfile(id: string): Promise<PublicProfile | null> {
  const found = await fetchProfilesByIds([id]);
  return found[0] ?? null;
}

export async function fetchStats(userId: string): Promise<ProfileStats> {
  const { data, error } = await requireSupabase()
    .from('profile_stats')
    .select('seed_count, water_count, harvest_count, rating_avg, rating_count')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    seedCount: Number(data?.seed_count ?? 0),
    waterCount: Number(data?.water_count ?? 0),
    harvestCount: Number(data?.harvest_count ?? 0),
    ratingAvg: data?.rating_avg == null ? null : Number(data.rating_avg),
    ratingCount: Number(data?.rating_count ?? 0),
  };
}

export async function updateProfile(
  userId: string,
  patch: { nickname?: string; bio?: string; avatarUrl?: string | null }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.nickname !== undefined) row.nickname = patch.nickname.trim();
  if (patch.bio !== undefined) row.bio = patch.bio.trim() || null;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  if (Object.keys(row).length === 0) return;

  const { error } = await requireSupabase().from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}

/** 肥料残高。水やり後などに取り直す */
export async function fetchFertilizer(userId: string): Promise<number> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('fertilizer')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.fertilizer ?? 0);
}

/** ログインボーナス。受け取れた量（0 なら今日は受け取り済み） */
export async function claimLoginBonus(): Promise<number> {
  const { data, error } = await requireSupabase().rpc('claim_login_bonus');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function canClaimLoginBonus(): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('can_claim_login_bonus');
  if (error) throw error;
  return Boolean(data);
}

// ── お届け先（初回出品前に必須）──────────────────────────

export async function fetchAddress(userId: string): Promise<Address | null> {
  const { data, error } = await requireSupabase()
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    lastName: data.last_name,
    firstName: data.first_name,
    phone: data.phone,
    postalCode: data.postal_code,
    prefecture: data.prefecture,
    city: data.city,
    street: data.street,
    building: data.building ?? '',
  };
}

export async function saveAddress(userId: string, a: Address): Promise<void> {
  const { error } = await requireSupabase().from('addresses').upsert(
    {
      user_id: userId,
      last_name: a.lastName.trim(),
      first_name: a.firstName.trim(),
      phone: a.phone.trim(),
      postal_code: a.postalCode.trim(),
      prefecture: a.prefecture.trim(),
      city: a.city.trim(),
      street: a.street.trim(),
      building: a.building.trim() || null,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

// ── 肥料の履歴 ─────────────────────────────────────────────

export type LedgerEntry = { id: string; amount: number; reason: string; createdAt: string };

export async function fetchLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
  const { data, error } = await requireSupabase()
    .from('fertilizer_ledger')
    .select('id, amount, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    amount: Number(r.amount),
    reason: r.reason,
    createdAt: r.created_at,
  }));
}
