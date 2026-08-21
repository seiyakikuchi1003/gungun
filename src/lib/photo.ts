import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * 写真の取得ヘルパー。
 * - takePhoto(): その場でカメラを起動して1枚撮影（切り抜きあり）
 * - pickFromLibrary(): 写真ライブラリから選択（複数可・切り抜きなし）
 * - cropPhoto(): 追加済みの写真を選び直して切り抜く（2026-08-13 指摘）
 *
 * 複数選択と切り抜きは同時に使えない（OS のピッカーの制約）。
 * そのため「まとめて選ぶ」と「1枚ずつ整えて入れる」を別の入口に分けている。
 *
 * ★呼び出し側の注意：モーダル（BottomSheetModal など）が開いている間に呼ぶと
 *   iOS では画面が出ない。閉じ切ってから呼ぶこと（PhotoSourceSheet 参照）。
 */

function denied(kind: 'カメラ' | '写真') {
  Alert.alert(
    `${kind}へのアクセスが許可されていません`,
    `「設定」アプリ → ぐんぐん から${kind}のアクセスを許可してください。`,
    [
      { text: 'あとで', style: 'cancel' },
      { text: '設定を開く', onPress: () => Linking.openSettings().catch(() => {}) },
    ]
  );
}

export async function takePhoto(): Promise<string[] | null> {
  // Web にはカメラ起動 API がないためライブラリにフォールバック
  if (Platform.OS === 'web') return pickFromLibrary();

  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    denied('カメラ');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: true,   // 撮った直後に切り抜ける
  });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets.map((a) => a.uri);
}

export async function pickFromLibrary(): Promise<string[] | null> {
  // iOS の「選択した写真のみ」設定でも選べるよう、granted だけで判断せず
  // limited（一部のみ許可）でもピッカーを開く
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') {
    denied('写真');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // 0.7 のままだと最近の端末の写真がアップロード上限に当たることがあった（項目3）。
    // 商品写真は画面で見る用途なので、0.6 まで落としても見た目は変わらない。
    quality: 0.6,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets.map((a) => a.uri);
}

/**
 * 追加済みの写真を「選び直して切り抜く」（2026-08-13 指摘）。
 *
 * 並べた写真をタップしたときに呼ぶ。OS 標準のトリミング画面が出る。
 *
 * ※ すでに端末に取り込んだ画像をアプリ内でそのまま切り抜くには
 *   ネイティブの画像加工モジュールが要り、追加すると新しいビルドが必要になる。
 *   今は配信で直せる範囲を優先し、ピッカー標準の切り抜きを使っている。
 */
export async function cropPhoto(): Promise<string[] | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') {
    denied('写真');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.6,
    allowsMultipleSelection: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  return [res.assets[0].uri];
}

/**
 * プロフィール画像を選ぶ。
 *
 * 通常の写真選択（quality 0.7・複数選択）だと、最近の端末の写真は
 * 2MB の上限を超えて「画像サイズが大きすぎます」で弾かれていた（2026-08-12 指摘）。
 * アイコンは小さく表示するので、正方形に切ってもらったうえで強めに圧縮する。
 */
export async function pickAvatar(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') {
    denied('写真');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,   // 正方形に切ってもらう＝そのぶん軽くなる
    aspect: [1, 1],
    quality: 0.5,
    allowsMultipleSelection: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0].uri;
}
