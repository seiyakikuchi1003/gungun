import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * 写真の取得ヘルパー。
 * - takePhoto(): その場でカメラを起動して1枚撮影
 * - pickFromLibrary(): 写真ライブラリから選択（複数可）
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
    quality: 0.7,
    allowsEditing: true,
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
    quality: 0.7,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });
  if (res.canceled || !res.assets?.length) return null;
  return res.assets.map((a) => a.uri);
}
