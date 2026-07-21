import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';
import { colors, fonts, radius, shadows } from '@/theme';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { Mikan } from '@/components/art/Mikan';
import { PressableScale } from '@/components/ui/PressableScale';
import { getUser, MockItem } from '@/data/mock';

type Props = {
  width: number;
  children: MockItem[]; // 木にぶら下がる商品（＝水やりされた商品）
  highlightId?: string | null; // 直近に追加された商品（NEW 表示）
  onPressNode?: (item: MockItem) => void;
  showEmptySlot?: boolean; // 「水やりを待っています」の空きスロット
  mascotText?: string;
};

const HEIGHT = 360;
const NODE = 66;

// 実の位置（キャンバス比率）。2行に振り分けてラベルの重なりを防ぐ。
const SLOTS: { x: number; y: number }[] = [
  { x: 0.27, y: 0.14 },
  { x: 0.73, y: 0.14 },
  { x: 0.27, y: 0.45 },
  { x: 0.73, y: 0.45 },
  { x: 0.50, y: 0.29 },
  { x: 0.50, y: 0.60 },
];

/**
 * 木のイラスト＋商品ノード（実）を描画するキャンバス。
 * 幹・葉・草は SVG、商品ノードは絶対配置の View で重ねる。
 */
export function TreeCanvas({ width, children, highlightId, onPressNode, showEmptySlot = true, mascotText }: Props) {
  const cx = width / 2;
  const slots = SLOTS.slice(0, Math.max(children.length + (showEmptySlot ? 1 : 0), 1));

  return (
    <View style={[styles.wrap, { width, height: HEIGHT }]}>
      {/* 背景：空〜草のイラスト */}
      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
        {/* 草の地面 */}
        <Ellipse cx={cx} cy={HEIGHT - 14} rx={width * 0.52} ry={34} fill="#CFE8B0" />
        <Ellipse cx={cx} cy={HEIGHT - 6} rx={width * 0.44} ry={24} fill="#B9DE95" />
        {/* 幹 */}
        <Path
          d={`M${cx - 16},${HEIGHT - 30}
              C${cx - 20},${HEIGHT * 0.62} ${cx - 14},${HEIGHT * 0.55} ${cx - 11},${HEIGHT * 0.5}
              L${cx + 11},${HEIGHT * 0.5}
              C${cx + 14},${HEIGHT * 0.55} ${cx + 20},${HEIGHT * 0.62} ${cx + 16},${HEIGHT - 30} Z`}
          fill="#B07C4F"
        />
        {/* 枝 */}
        <G stroke="#B07C4F" strokeWidth={9} strokeLinecap="round" fill="none">
          <Path d={`M${cx},${HEIGHT * 0.52} C${cx - 40},${HEIGHT * 0.46} ${cx - 70},${HEIGHT * 0.42} ${cx - 92},${HEIGHT * 0.34}`} />
          <Path d={`M${cx},${HEIGHT * 0.5} C${cx + 40},${HEIGHT * 0.44} ${cx + 70},${HEIGHT * 0.4} ${cx + 92},${HEIGHT * 0.3}`} />
          <Path d={`M${cx},${HEIGHT * 0.5} C${cx - 8},${HEIGHT * 0.4} ${cx - 4},${HEIGHT * 0.34} ${cx},${HEIGHT * 0.24}`} />
        </G>
        {/* 葉（重なる緑の塊で丸いこんもり感） */}
        <G>
          <Circle cx={cx} cy={HEIGHT * 0.28} r={width * 0.30} fill="#8FD06A" />
          <Circle cx={cx - width * 0.24} cy={HEIGHT * 0.34} r={width * 0.19} fill="#8FD06A" />
          <Circle cx={cx + width * 0.24} cy={HEIGHT * 0.32} r={width * 0.2} fill="#8FD06A" />
          <Circle cx={cx - width * 0.1} cy={HEIGHT * 0.16} r={width * 0.16} fill="#A2DA80" />
          <Circle cx={cx + width * 0.12} cy={HEIGHT * 0.18} r={width * 0.17} fill="#A2DA80" />
          <Circle cx={cx} cy={HEIGHT * 0.32} r={width * 0.22} fill="#A2DA80" opacity={0.7} />
        </G>
      </Svg>

      {/* 商品ノード（実） */}
      {children.map((item, i) => {
        const slot = slots[i];
        if (!slot) return null;
        const left = slot.x * width - NODE / 2;
        const top = slot.y * HEIGHT;
        const owner = getUser(item.ownerId);
        const isNew = item.id === highlightId;
        return (
          <View key={item.id} style={[styles.node, { left, top, width: NODE }]}>
            {/* つるして見せる小さな軸 */}
            <View style={styles.stem} />
            <PressableScale activeScale={0.92} onPress={() => onPressNode?.(item)} style={[styles.bubble, shadows.card, isNew && styles.bubbleNew]}>
              <Thumb source={item.local} uri={item.image} style={styles.nodeImg} radius={NODE / 2} markSize={26} />
              <View style={styles.ownerDot}>
                <Avatar uri={owner.avatar} name={owner.nickname} size={22} />
              </View>
              <View style={[styles.countBadge, item.waterCount > 0 ? styles.countOn : styles.countZero]}>
                <Text style={[styles.countText, item.waterCount === 0 && styles.countTextZero]}>{item.waterCount}</Text>
              </View>
              {isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newText}>NEW</Text>
                </View>
              )}
            </PressableScale>
            <Text style={styles.nodeName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.nodeOwner} numberOfLines={1}>{owner.nickname}さん</Text>
          </View>
        );
      })}

      {/* 空きスロット（水やり待ち） */}
      {showEmptySlot && slots[children.length] && (
        <View style={[styles.node, { left: slots[children.length].x * width - NODE / 2, top: slots[children.length].y * HEIGHT, width: NODE }]}>
          <View style={styles.stem} />
          <View style={styles.emptyBubble}>
            <Text style={styles.emptyPlus}>＋</Text>
          </View>
          <Text style={styles.emptyLabel} numberOfLines={2}>水やりを{'\n'}待っています</Text>
        </View>
      )}

      {/* みかんマスコット＋吹き出し */}
      <View style={styles.mascot}>
        {mascotText ? (
          <View style={styles.speech}>
            <Text style={styles.speechText}>{mascotText}</Text>
          </View>
        ) : null}
        <Mikan size={44} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', overflow: 'hidden' },
  node: { position: 'absolute', alignItems: 'center' },
  stem: { width: 2, height: 12, backgroundColor: '#8B6B47', borderRadius: 1 },
  bubble: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.white, padding: 3, borderWidth: 3, borderColor: colors.white },
  bubbleNew: { borderColor: colors.orange },
  nodeImg: { width: '100%', height: '100%', borderRadius: NODE / 2 },
  ownerDot: { position: 'absolute', bottom: -2, right: -4, borderRadius: 13, borderWidth: 2, borderColor: colors.white },
  countBadge: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  countOn: { backgroundColor: colors.orange },
  countZero: { backgroundColor: colors.textPlaceholder },
  countText: { fontFamily: fonts.black, fontSize: 11, color: colors.white },
  countTextZero: { color: colors.white },
  newBadge: { position: 'absolute', top: -10, left: -8, backgroundColor: colors.green, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.white },
  newText: { fontFamily: fonts.black, fontSize: 8, color: colors.white, letterSpacing: 0.3 },
  nodeName: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textPrimary, marginTop: 6, maxWidth: NODE + 34, textAlign: 'center' },
  nodeOwner: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textSecondary, maxWidth: NODE + 34, textAlign: 'center' },
  emptyBubble: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2, borderColor: colors.greenSoftBorder, borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
  emptyPlus: { fontFamily: fonts.bold, fontSize: 26, color: colors.green, marginTop: -2 },
  emptyLabel: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textSecondary, marginTop: 5, textAlign: 'center', lineHeight: 13 },
  mascot: { position: 'absolute', left: 10, bottom: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  speech: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6, ...shadows.soft },
  speechText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.green },
});
