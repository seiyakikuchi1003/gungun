import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fonts, radius } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Thumb } from '@/components/ui/Thumb';
import { PressableScale } from '@/components/ui/PressableScale';
import { WateringCan } from '@/components/art/WateringCan';
import { settings } from '@/config/settings';
import type { MockItem } from '@/data/mock';

type Props = {
  visible: boolean;
  item: MockItem;
  ownerName: string;
  currentFertilizer: number;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * 水やり確認モーダル（画像5）。
 * 必要な肥料は settings.waterCost（＝将来 app_settings から差し替え）。
 */
export function WaterConfirmSheet({ visible, item, ownerName, currentFertilizer, onClose, onConfirm }: Props) {
  const cost = settings.waterCost;
  const after = currentFertilizer - cost;
  const enough = after >= 0;

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.center}>
        <WateringCan size={110} />
        <Text style={styles.title}>水やりしますか？</Text>
      </View>

      {/* 対象商品 */}
      <View style={styles.itemCard}>
        <Thumb source={item.local} uri={item.image} style={styles.thumb} radius={radius.md} markSize={28} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemOwner}>{ownerName}さんのタネ</Text>
        </View>
      </View>

      {/* 肥料計算 */}
      <View style={styles.calcBox}>
        <Row label="必要な肥料" value={`${cost}肥料`} />
        <Row label="現在の肥料" value={`${currentFertilizer}肥料`} />
        <View style={styles.divider} />
        <View style={styles.afterRow}>
          <Text style={styles.afterLabel}>水やり後</Text>
          <View style={styles.afterValueRow}>
            <Text style={[styles.afterNum, !enough && styles.afterNumBad]}>{after}</Text>
            <Text style={[styles.afterUnit, !enough && styles.afterNumBad]}>肥料</Text>
          </View>
        </View>
      </View>

      {enough ? (
        <Button title="水やりする" onPress={onConfirm} style={{ marginTop: spacing.xl }} />
      ) : (
        <Button title="肥料をチャージする" variant="accent" onPress={onConfirm} style={{ marginTop: spacing.xl }} />
      )}
      <PressableScale onPress={onClose} style={styles.cancel}>
        <Text style={styles.cancelText}>キャンセル</Text>
      </PressableScale>
    </BottomSheetModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.cardMuted, borderRadius: radius.card, padding: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.border },
  itemName: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  itemOwner: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  calcBox: { backgroundColor: colors.greenSoft, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary },
  rowValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.greenSoftBorder },
  afterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  afterLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  afterValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  afterNum: { fontFamily: fonts.black, fontSize: 28, color: colors.green },
  afterUnit: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  afterNumBad: { color: colors.orangeDeep },
  cancel: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
