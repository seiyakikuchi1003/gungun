import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Sprout } from '@/components/art/Sprout';
import { MockItem } from '@/data/mock';

type Props = {
  title: string;
  subtitle?: string;
  items: MockItem[];
  width: number; // 画面幅
  onPressItem: (item: MockItem) => void;
};

const PAD = 16;
const GAP = 8;

/**
 * 画像主役の1枚カード。オーバーレイはメルカリの金額チップのように
 * モノトーン（半透明ダーク＋白ハート）で控えめにし、色数を抑える。
 */
function Card({ item, w, h, onPress }: { item: MockItem; w: number; h: number; onPress: () => void }) {
  const isNew = item.waterCount <= 1;
  return (
    <PressableScale onPress={onPress} activeScale={0.97} style={[styles.card, { width: w, height: h }, shadows.card]}>
      <Thumb source={item.local} uri={item.image} style={styles.img} markSize={Math.min(w, h) * 0.4} />
      {isNew && (
        <View style={styles.newChip}><Text style={styles.newChipText}>NEW</Text></View>
      )}
      <View style={styles.heart}>
        <Ionicons name="heart-outline" size={15} color={colors.textPrimary} />
      </View>
      <View style={styles.waterPill}>
        <Sprout size={10} color="#fff" />
        <Text style={styles.waterText}>水やり{item.waterCount}</Text>
      </View>
    </PressableScale>
  );
}

/**
 * メルカリ風のモザイク・グループ。
 * 見出し（テーマ）＋ 大1枚＋小2枚のヒーロー行 ＋ 3列の続き。
 */
export function MosaicGroup({ title, subtitle, items, width, onPressItem }: Props) {
  const contentW = width - PAD * 2;
  const hero = items[0];
  const rightItems = items.slice(1, 3);
  const rest = items.slice(3);

  const heroW = Math.round(contentW * 0.6);
  const heroH = Math.round(heroW * 1.15);
  const rightW = contentW - heroW - GAP;
  const rightH = (heroH - GAP) / 2;
  const cellW = (contentW - GAP * 2) / 3;

  if (!hero) return null;

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <PressableScale activeScale={0.9} style={styles.hIcon}>
          <Ionicons name="heart-outline" size={20} color={colors.textSecondary} />
        </PressableScale>
        <PressableScale activeScale={0.9} style={styles.hIcon}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </PressableScale>
      </View>

      {/* ヒーロー行：大1枚 ＋ 小1〜2枚（縦積み） */}
      <View style={styles.heroRow}>
        <Card item={hero} w={heroW} h={heroH} onPress={() => onPressItem(hero)} />
        {rightItems.length > 0 && (
          <View style={{ gap: GAP }}>
            {rightItems.map((it) => (
              <Card key={it.id} item={it} w={rightW} h={rightItems.length === 1 ? heroH : rightH} onPress={() => onPressItem(it)} />
            ))}
          </View>
        )}
      </View>

      {/* 続き：3列 */}
      {rest.length > 0 && (
        <View style={styles.rest}>
          {rest.map((it) => (
            <Card key={it.id} item={it} w={cellW} h={cellW} onPress={() => onPressItem(it)} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing['2xl'] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: PAD, marginBottom: spacing.md },
  title: { fontFamily: fonts.black, fontSize: 17, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  hIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', ...shadows.soft },
  heroRow: { flexDirection: 'row', gap: GAP, paddingHorizontal: PAD },
  rest: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD, marginTop: GAP },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.cardMuted },
  img: { width: '100%', height: '100%' },
  newChip: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(38,34,28,0.6)', paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: radius.pill },
  newChipText: { fontFamily: fonts.black, fontSize: 9.5, color: '#fff', letterSpacing: 0.5 },
  heart: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  waterPill: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(38,34,28,0.6)', paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: radius.pill },
  waterText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' },
});
