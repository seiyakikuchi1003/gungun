import React, { useCallback, useRef } from 'react';
import { errorMessage } from '@/lib/errorMessage';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { PressableScale } from '@/components/ui/PressableScale';
import { takePhoto, pickFromLibrary } from '@/lib/photo';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 取得した写真URI（複数可）。fromCamera＝その場で撮った1枚（撮った直後に切り抜きへ回す） */
  onPicked: (uris: string[], fromCamera: boolean) => void;
};

type Picker = () => Promise<string[] | null>;

/**
 * 写真の追加方法を選ぶシート。
 * 「カメラで撮影」＝その場撮影（撮った直後に自前の切り抜き画面へ：2026-08-21 指摘） ／
 * 「ライブラリから選択」＝まとめて選ぶ。
 *
 * 切り抜きはここには置かない。追加した写真をタップすると切り抜ける
 * （選ぶ前に決めさせるより、並べてから直す方が自然：2026-08-13 指摘）。
 *
 * ★重要：カメラ／写真ライブラリは **このシートが閉じ切ってから** 起動する。
 * モーダルが表示されている間に起動しようとすると、iOS では画面が出ず
 * 「押しても何も起きない」状態になる（実機で発生）。
 * そのため実行したい処理を保留しておき、閉じ終わってから動かす。
 */
export function PhotoSourceSheet({ visible, onClose, onPicked }: Props) {
  const pending = useRef<Picker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const fn = pending.current;
    if (!fn) return;
    const fromCamera = fn === takePhoto;
    pending.current = null; // 二重起動を防ぐ
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      const uris = await fn();
      if (uris && uris.length) onPicked(uris, fromCamera);
    } catch (e) {
      // 黙って何も起きないのが一番困るので、理由を出す
      Alert.alert(
        '写真を開けませんでした',
        errorMessage(e, 'もう一度お試しください。')
      );
    }
  }, [onPicked]);

  const run = (fn: Picker) => {
    pending.current = fn;
    onClose();
    // Android は Modal の onDismiss が呼ばれないため保険をかける。
    // iOS でも念のため（flush 側で二重起動は防いでいる）。
    timer.current = setTimeout(flush, Platform.OS === 'ios' ? 450 : 250);
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} onDismissed={flush}>
      <Text style={styles.title}>写真を追加</Text>
      <View style={styles.row}>
        <PressableScale activeScale={0.96} onPress={() => run(takePhoto)} style={styles.opt}>
          <View style={[styles.icon, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="camera" size={28} color={colors.green} />
          </View>
          <Text style={styles.optLabel}>カメラで撮影</Text>
          <Text style={styles.optSub}>その場で撮る</Text>
        </PressableScale>
        <PressableScale activeScale={0.96} onPress={() => run(pickFromLibrary)} style={styles.opt}>
          <View style={[styles.icon, { backgroundColor: colors.waterBlueBg }]}>
            <Ionicons name="images" size={26} color={colors.waterBlue} />
          </View>
          <Text style={styles.optLabel}>ライブラリから選択</Text>
          <Text style={styles.optSub}>フォルダから選ぶ</Text>
        </PressableScale>
      </View>

      <PressableScale onPress={onClose} style={styles.cancel}>
        <Text style={styles.cancelText}>キャンセル</Text>
      </PressableScale>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  opt: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: spacing.xl, borderWidth: 1, borderColor: colors.border },
  icon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  optLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  optSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  cropRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  cropIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cancel: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
