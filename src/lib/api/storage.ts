import { requireSupabase } from '@/lib/supabase';

/**
 * 商品画像のアップロード（Supabase Storage）。
 *
 * バケットは 0006 で作った `item-images`。
 * パスは `<user_id>/<ランダム>.jpg` 固定にしてある（RLS が1階層目のフォルダ名と
 * auth.uid() を突き合わせるため、ここを変えると書き込めなくなる）。
 */

const BUCKET = 'item-images';

function extOf(uri: string): string {
  const m = uri.match(/\.(jpe?g|png|webp)(\?|$)/i);
  return (m?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
}

function mimeOf(ext: string): string {
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

function randomName(ext: string): string {
  // crypto.randomUUID は RN でも polyfill 済み（react-native-get-random-values 不要な範囲で使う）
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${rand}.${ext}`;
}

/**
 * 端末のローカル URI（file:// や content://）を1枚アップロードして、公開URLを返す。
 * すでに http(s) の URL ならアップロードせずそのまま返す（編集時に既存画像を残すため）。
 */
export async function uploadImage(userId: string, uri: string): Promise<string> {
  if (/^https?:\/\//i.test(uri)) return uri;

  const sb = requireSupabase();
  const ext = extOf(uri);
  const path = `${userId}/${randomName(ext)}`;

  // RN では fetch(uri) → blob/arrayBuffer でファイル内容を読める
  const res = await fetch(uri);
  const bytes = await res.arrayBuffer();

  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeOf(ext),
    upsert: false,
  });
  if (error) throw error;

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** 複数枚を順番にアップロード（順序＝表示順なので並列にしない） */
export async function uploadImages(userId: string, uris: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const uri of uris) out.push(await uploadImage(userId, uri));
  return out;
}
