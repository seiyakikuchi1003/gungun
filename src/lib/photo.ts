import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * 写真の取得ヘルパー。
 * - takePhoto(): その場でカメラを起動して1枚撮影
 * - pickFromLibrary(): 写真ライブラリから選択（複数可）
 * 権限が拒否された場合は案内を出して null を返す。
 */

function denied(kind: 'カメラ' | '写真') {
  Alert.alert(
    `${kind}へのアクセスが必要です`,
    `設定 > ぐんぐん から${kind}のアクセスを許可してください。`,
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
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
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
