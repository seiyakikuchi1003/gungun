import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { PressableScale } from '@/components/ui/PressableScale';
import { useTree } from '@/store/tree';
import { useBlocks } from '@/store/blocks';
import { getUser } from '@/data/mock';
import { success, warning } from '@/lib/haptics';
import type { MockItem } from '@/data/mock';

type Props = {
  visible: boolean;
  onClose: () => void;
  item: MockItem;
  isOwner: boolean;
  /** 「通報する」を選んだとき（親が ReportSheet を開く） */
  onReport: () => void;
  /** 削除後に呼ばれる（親で画面を戻すなど） */
  onDeleted?: () => void;
};

/**
 * 商品の「…」メニュー。
 * 自分の出品：編集 / 削除（削除時は子ノードが新しい種として独立）
 * 他人の出品：シェア / 通報 / 出品者をブロック
 */
export function ItemActionSheet({ visible, onClose, item, isOwner, onReport, onDeleted }: Props) {
  const { deleteItem } = useTree();
  const { block } = useBlocks();
  const [mode, setMode] = useState<'menu' | 'confirmDelete' | 'confirmBlock'>('menu');
  const owner = getUser(item.ownerId);

  const close = () => {
    onClose();
    setTimeout(() => setMode('menu'), 250);
  };

  const doDelete = () => {
    warning();
    deleteItem(item.id);
    close();
    onDeleted?.();
  };

  const doBlock = () => {
    success();
    block(item.ownerId);
    close();
  };

  return (
    <BottomSheetModal visible={visible} onClose={close}>
      {mode === 'menu' && (
        <View style={styles.list}>
          {isOwner ? (
            <>
              <Row
                icon="create-outline"
                label="出品を編集する"
                onPress={() => { close(); router.push(`/item/edit/${item.id}`); }}
              />
              <Row
                icon="trash-outline"
                label="出品を削除する"
                danger
                onPress={() => setMode('confirmDelete')}
              />
            </>
          ) : (
            <>
              <Row icon="flag-outline" label="この出品を通報する" onPress={() => { onClose(); onReport(); }} />
              <Row
                icon="ban-outline"
                label={`${owner.nickname}さんをブロックする`}
                danger
                onPress={() => setMode('confirmBlock')}
              />
            </>
          )}
          <Row icon="close" label="キャンセル" muted onPress={close} />
        </View>
      )}

      {mode === 'confirmDelete' && (
        <Confirm
          title="この出品を削除しますか？"
          body={
            item.parentId === null
              ? 'この木にぶら下がっている他の人の商品は、それぞれ新しいタネとして残ります。'
              : 'この操作は取り消せません。'
          }
          confirmLabel="削除する"
          onConfirm={doDelete}
          onCancel={() => setMode('menu')}
        />
      )}

      {mode === 'confirmBlock' && (
        <Confirm
          title={`${owner.nickname}さんをブロックしますか？`}
          body="ブロックすると、この人の出品や投稿が表示されなくなります。マイページからいつでも解除できます。"
          confirmLabel="ブロックする"
          onConfirm={doBlock}
          onCancel={() => setMode('menu')}
        />
      )}
    </BottomSheetModal>
  );
}

function Row({
  icon,
  label,
  onPress,
  danger,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  const color = danger ? colors.heart : muted ? colors.textSecondary : colors.textPrimary;
  return (
    <PressableScale onPress={onPress} activeScale={0.98} style={styles.row}>
      <Ionicons name={icon} size={21} color={color} />
      <Text style={[styles.rowText, { color }]}>{label}</Text>
    </PressableScale>
  );
}

function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.confirm}>
      <Text style={styles.confirmTitle}>{title}</Text>
      <Text style={styles.confirmBody}>{body}</Text>
      <PressableScale onPress={onConfirm} activeScale={0.97} style={[styles.danger, shadows.button]}>
        <Text style={styles.dangerText}>{confirmLabel}</Text>
      </PressableScale>
      <PressableScale onPress={onCancel} activeScale={0.98} style={styles.cancel}>
        <Text style={styles.cancelText}>キャンセル</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 15, paddingHorizontal: spacing.sm },
  rowText: { fontFamily: fonts.bold, fontSize: 15.5 },
  confirm: { paddingBottom: spacing.sm },
  confirmTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  confirmBody: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: spacing.lg },
  danger: { height: 54, borderRadius: radius.pill, backgroundColor: colors.heart, justifyContent: 'center', alignItems: 'center' },
  dangerText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  cancel: { height: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textSecondary },
});
