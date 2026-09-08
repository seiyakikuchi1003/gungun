import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, G, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { colors, fonts, radius, shadows } from '@/theme';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { Mikan } from '@/components/art/Mikan';
import { PressableScale } from '@/components/ui/PressableScale';
import { treeVisual, MockItem } from '@/data/mock';
import { useUsers } from '@/store/users';

type Props = {
  width: number;
  /**
   * 木にぶら下げる商品。
   * 以前は直接の子（1段目）だけだったが、連鎖しているのに木が育って見えず、
   * 何段目まで伸びているのか分からなかった（2026-08-21 指摘）。
   * 呼び出し側で3段目までを渡す。深さ順に並んでいる前提。
   */
  children: MockItem[];
  treeSize?: number; // 木に属する総数（root＋子孫）。未指定なら children+1
  highlightId?: string | null; // 直近に追加された商品（NEW 表示）
  onPressNode?: (item: MockItem) => void;
  onPressEmpty?: () => void; // 空きスロット「水やり待ち」をタップ
  /** 入りきらなかったぶんの「その他を見る」（2026-08-21 指摘） */
  onPressMore?: () => void;
  showEmptySlot?: boolean;
  mascotText?: string;
};

const HEIGHT = 380;
const NODE = 60;

// キャノピー中心からの相対オフセット（canopyR 比）。
// 同じ列で縦に積み重ならないよう、左右2列＋上中央に振り分ける。
const OFFSETS: { dx: number; dy: number }[] = [
  { dx: -0.6, dy: -0.26 },
  { dx: 0.6, dy: -0.26 },
  { dx: 0.0, dy: -0.66 },
  { dx: -0.6, dy: 0.42 },
  { dx: 0.6, dy: 0.42 },
  { dx: 0.0, dy: 0.16 },
];

// 装飾（みかんの実・花）の相対位置。stage が上がるほど多く表示。
const FRUITS = [
  { dx: -0.72, dy: 0.28 }, { dx: 0.7, dy: 0.34 }, { dx: -0.15, dy: 0.66 },
  { dx: 0.5, dy: -0.5 }, { dx: -0.5, dy: -0.5 }, { dx: 0.24, dy: 0.62 },
];
const BLOOMS = [
  { dx: -0.42, dy: -0.28 }, { dx: 0.4, dy: -0.16 }, { dx: 0.12, dy: -0.5 }, { dx: -0.66, dy: -0.02 },
];

// 2026-07-28 MTG（めたん様）：木の大小を示す表現は使わない。
// 数が増えたことを事実として伝えるだけにする。

export function TreeCanvas({ width, children, treeSize, highlightId, onPressNode, onPressEmpty, onPressMore, showEmptySlot = true, mascotText }: Props) {
  const users = useUsers();
  const cx = width / 2;
  const size = treeSize ?? children.length + 1;
  const stage = treeVisual(size).stage;

  // 成長段階でキャノピー半径・幹の高さを決める
  const canopyR = width * (stage === 0 ? 0.16 : stage === 1 ? 0.33 : stage === 2 ? 0.4 : 0.46);
  const canopyCY = HEIGHT * (stage === 0 ? 0.52 : stage === 1 ? 0.38 : stage === 2 ? 0.34 : 0.32);
  const grassY = HEIGHT - 16;
  const trunkTopY = canopyCY + canopyR * 0.32;
  const trunkW = 8 + stage * 4;

  // キャンバス上の実の数。3段目までを見せるので、以前の4個では足りない。
  // 「その他を見る」を出すぶん、1枠を空けておく（2026-08-21 指摘）。
  const MAX_NODES = 5;
  const shown = children.slice(0, MAX_NODES);
  const extra = children.length - shown.length;
  // 空きスロット（＋水やりする）と「その他を見る」は同じ余り枠を取り合うので、
  // 入りきらなかったぶんがあるときは「その他を見る」を優先する。
  const wantMore = extra > 0 && !!onPressMore;
  const wantEmpty = showEmptySlot && !wantMore && shown.length < MAX_NODES;
  const tailSlots = (wantEmpty || wantMore) ? 1 : 0;
  const slots = OFFSETS.slice(0, Math.max(shown.length + tailSlots, 1));
  const pos = (o: { dx: number; dy: number }) => ({
    x: cx + o.dx * canopyR,
    y: canopyCY + o.dy * canopyR,
  });
  // 「大きい／小さい」ではなく、集まった件数をそのまま伝える
  const waterings = Math.max(0, size - 1);
  const speech =
    mascotText ?? (waterings === 0 ? 'さいしょの水やりを待ってるよ' : `水やりが${waterings}件あつまってるよ！`);

  return (
    <View style={[styles.wrap, { width, height: HEIGHT }]}>
      <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FBF6EA" />
            <Stop offset="1" stopColor="#EEF6E2" />
          </LinearGradient>
          <RadialGradient id="leaf" cx="0.4" cy="0.3" r="0.8">
            <Stop offset="0" stopColor="#A7E07E" />
            <Stop offset="1" stopColor="#78C24F" />
          </RadialGradient>
          <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#CBE9A6" />
            <Stop offset="1" stopColor="#AEDD86" />
          </LinearGradient>
          <LinearGradient id="trunk" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#9C6B3F" />
            <Stop offset="0.5" stopColor="#B98A5B" />
            <Stop offset="1" stopColor="#8A5D36" />
          </LinearGradient>
        </Defs>

        {/* 空 */}
        <Path d={`M0 0 H${width} V${HEIGHT} H0 Z`} fill="url(#sky)" />
        {/* やわらかい太陽 */}
        <Circle cx={width - 34} cy={40} r={26} fill="#FCE9B8" opacity={0.7} />
        <Circle cx={width - 34} cy={40} r={17} fill="#FBDE94" opacity={0.8} />

        {/* 地面 */}
        <Ellipse cx={cx} cy={grassY} rx={width * 0.54} ry={30} fill="url(#grass)" />
        <Ellipse cx={cx} cy={grassY + 8} rx={width * 0.46} ry={20} fill="#9FD675" />
        {/* 小花 */}
        {[-0.36, 0.3, 0.44].map((f, i) => (
          <G key={i}>
            <Circle cx={cx + f * width} cy={grassY - 2 + (i % 2) * 6} r={3} fill={i % 2 ? '#F4A9C0' : '#FBD46A'} />
            <Circle cx={cx + f * width} cy={grassY - 2 + (i % 2) * 6} r={1.2} fill="#fff" />
          </G>
        ))}

        {stage === 0 ? (
          /* まだ水やりがない状態：どんぐり＋双葉 */
          <G>
            <Path d={`M${cx},${grassY - 6} L${cx},${grassY - 34}`} stroke="#79B255" strokeWidth={5} strokeLinecap="round" />
            <Path d={`M${cx},${grassY - 26} C${cx - 26},${grassY - 30} ${cx - 30},${grassY - 46} ${cx - 14},${grassY - 50} C${cx - 8},${grassY - 40} ${cx - 4},${grassY - 32} ${cx},${grassY - 28} Z`} fill="url(#leaf)" />
            <Path d={`M${cx},${grassY - 30} C${cx + 26},${grassY - 34} ${cx + 30},${grassY - 50} ${cx + 14},${grassY - 54} C${cx + 8},${grassY - 44} ${cx + 4},${grassY - 36} ${cx},${grassY - 32} Z`} fill="url(#leaf)" />
            <Ellipse cx={cx} cy={grassY - 4} rx={12} ry={9} fill="#B5793F" />
          </G>
        ) : (
          <>
            {/* 幹 */}
            <Path
              d={`M${cx - trunkW},${grassY - 6}
                  C${cx - trunkW - 2},${(grassY + trunkTopY) / 2} ${cx - trunkW + 1},${trunkTopY + 12} ${cx - trunkW * 0.7},${trunkTopY}
                  L${cx + trunkW * 0.7},${trunkTopY}
                  C${cx + trunkW - 1},${trunkTopY + 12} ${cx + trunkW + 2},${(grassY + trunkTopY) / 2} ${cx + trunkW},${grassY - 6} Z`}
              fill="url(#trunk)"
            />
            {/* 根の張り出し */}
            <Path d={`M${cx - trunkW},${grassY - 6} C${cx - trunkW - 14},${grassY - 2} ${cx - trunkW - 20},${grassY + 2} ${cx - trunkW - 24},${grassY + 4}`} stroke="#8A5D36" strokeWidth={6} strokeLinecap="round" fill="none" />
            <Path d={`M${cx + trunkW},${grassY - 6} C${cx + trunkW + 14},${grassY - 2} ${cx + trunkW + 20},${grassY + 2} ${cx + trunkW + 24},${grassY + 4}`} stroke="#8A5D36" strokeWidth={6} strokeLinecap="round" fill="none" />

            {/* 枝（stage 2 以上で増える） */}
            <G stroke="url(#trunk)" strokeWidth={trunkW * 0.7} strokeLinecap="round" fill="none">
              <Path d={`M${cx},${trunkTopY} C${cx - canopyR * 0.5},${trunkTopY - 6} ${cx - canopyR * 0.7},${canopyCY} ${cx - canopyR * 0.7},${canopyCY - canopyR * 0.2}`} />
              <Path d={`M${cx},${trunkTopY} C${cx + canopyR * 0.5},${trunkTopY - 6} ${cx + canopyR * 0.7},${canopyCY} ${cx + canopyR * 0.7},${canopyCY - canopyR * 0.2}`} />
              {stage >= 2 && <Path d={`M${cx},${trunkTopY - 4} C${cx - 4},${canopyCY} ${cx},${canopyCY - canopyR * 0.5} ${cx},${canopyCY - canopyR * 0.6}`} />}
            </G>

            {/* 葉（こんもり。stage で層が増える） */}
            <G>
              <Circle cx={cx} cy={canopyCY} r={canopyR} fill="url(#leaf)" />
              <Circle cx={cx - canopyR * 0.7} cy={canopyCY + canopyR * 0.15} r={canopyR * 0.62} fill="url(#leaf)" />
              <Circle cx={cx + canopyR * 0.7} cy={canopyCY + canopyR * 0.1} r={canopyR * 0.66} fill="url(#leaf)" />
              <Circle cx={cx - canopyR * 0.35} cy={canopyCY - canopyR * 0.55} r={canopyR * 0.5} fill="url(#leaf)" />
              <Circle cx={cx + canopyR * 0.4} cy={canopyCY - canopyR * 0.5} r={canopyR * 0.52} fill="url(#leaf)" />
              {stage >= 3 && (
                <>
                  <Circle cx={cx - canopyR * 0.9} cy={canopyCY - canopyR * 0.35} r={canopyR * 0.4} fill="url(#leaf)" />
                  <Circle cx={cx + canopyR * 0.92} cy={canopyCY - canopyR * 0.3} r={canopyR * 0.42} fill="url(#leaf)" />
                </>
              )}
              {/* ハイライト */}
              <Circle cx={cx - canopyR * 0.25} cy={canopyCY - canopyR * 0.45} r={canopyR * 0.34} fill="#B9E88F" opacity={0.55} />
              <Circle cx={cx + canopyR * 0.3} cy={canopyCY - canopyR * 0.2} r={canopyR * 0.28} fill="#B9E88F" opacity={0.45} />
            </G>

            {/* 花（stage 1〜2 で咲く） */}
            {stage <= 2 && BLOOMS.slice(0, stage === 1 ? 2 : 4).map((b, i) => {
              const p = pos(b);
              return <Circle key={`b${i}`} cx={p.x} cy={p.y} r={4} fill="#FBD9E6" stroke="#F4A9C0" strokeWidth={1.4} />;
            })}
            {/* みかんの実（商品が増えるほど鈴なりになる装飾） */}
            {stage >= 2 && FRUITS.slice(0, stage === 2 ? 3 : 6).map((fr, i) => {
              const p = pos(fr);
              return (
                <G key={`f${i}`}>
                  <Circle cx={p.x} cy={p.y} r={7} fill="#F2963A" />
                  <Circle cx={p.x - 2} cy={p.y - 2} r={2} fill="#FBC589" opacity={0.8} />
                  <Path d={`M${p.x},${p.y - 7} l3,-4`} stroke="#7CB342" strokeWidth={2} strokeLinecap="round" />
                </G>
              );
            })}
          </>
        )}
      </Svg>

      {/* 商品ノード（実） */}
      {shown.map((item, i) => {
        const slot = slots[i];
        if (!slot) return null;
        const p = pos(slot);
        const owner = users.user(item.ownerId);
        const isNew = item.id === highlightId;
        return (
          <View key={item.id} style={[styles.node, { left: p.x - NODE / 2, top: p.y - NODE / 2, width: NODE }]}>
            <View style={styles.stem} />
            <PressableScale activeScale={0.92} onPress={() => onPressNode?.(item)} style={[styles.bubble, shadows.card, isNew && styles.bubbleNew]}>
              <Thumb source={item.local} uri={item.image} style={styles.nodeImg} radius={NODE / 2} markSize={26} />
              <View style={styles.ownerDot}>
                <Avatar uri={owner.avatar} name={owner.nickname} size={20} />
              </View>
              <View style={[styles.countBadge, item.waterCount > 0 ? styles.countOn : styles.countZero]}>
                <Text style={styles.countText}>{item.waterCount}</Text>
              </View>
              {isNew && (
                <View style={styles.newBadge}><Text style={styles.newText}>NEW</Text></View>
              )}
              {/* 何段目の水やりか。連鎖して伸びていることが見て分かるように */}
              {item.depth > 1 && (
                <View style={styles.depthBadge}>
                  <Text style={styles.depthText}>{item.depth}段</Text>
                </View>
              )}
            </PressableScale>
            <Text style={styles.nodeName} numberOfLines={1}>{item.name}</Text>
          </View>
        );
      })}

      {/* 入りきらなかったぶん：「その他を見る」もぶら下げる（2026-08-21 指摘）。
          残数チップだけだと押せるように見えず、木の外に置かれて繋がりも見えなかった */}
      {wantMore && slots[shown.length] && (() => {
        const p = pos(slots[shown.length]);
        return (
          <View style={[styles.node, { left: p.x - NODE / 2, top: p.y - NODE / 2, width: NODE }]}>
            <View style={styles.stem} />
            <PressableScale activeScale={0.9} onPress={onPressMore} style={styles.moreBubble}>
              <Text style={styles.moreNum}>+{extra}</Text>
            </PressableScale>
            <Text style={styles.nodeName} numberOfLines={1}>その他を見る</Text>
          </View>
        );
      })()}

      {/* 空きスロット（水やり待ち） */}
      {wantEmpty && slots[shown.length] && (() => {
        const p = pos(slots[shown.length]);
        return (
          <View style={[styles.node, { left: p.x - NODE / 2, top: p.y - NODE / 2, width: NODE }]}>
            <View style={styles.stem} />
            <PressableScale activeScale={0.9} onPress={onPressEmpty} style={styles.emptyBubble}>
              <Text style={styles.emptyPlus}>＋</Text>
            </PressableScale>
            <Text style={styles.emptyLabel} numberOfLines={1}>水やりする</Text>
          </View>
        );
      })()}

      {/* 実が多いときの残数チップ（「その他を見る」を出せないときだけ） */}
      {extra > 0 && !wantMore && (
        <View style={styles.extraChip}>
          <Text style={styles.extraText}>ほか +{extra}個</Text>
        </View>
      )}

      {/* みかんマスコット＋吹き出し */}
      <View style={styles.mascot}>
        <View style={styles.speech}><Text style={styles.speechText}>{speech}</Text></View>
        <Mikan size={44} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', overflow: 'hidden', borderRadius: radius.lg },
  node: { position: 'absolute', alignItems: 'center' },
  stem: { width: 2, height: 12, backgroundColor: '#8B6B47', borderRadius: 1 },
  bubble: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.white, padding: 3, borderWidth: 3, borderColor: colors.white },
  bubbleNew: { borderColor: colors.orange },
  nodeImg: { width: '100%', height: '100%', borderRadius: NODE / 2 },
  ownerDot: { position: 'absolute', bottom: -2, right: -4, borderRadius: 12, borderWidth: 2, borderColor: colors.white },
  countBadge: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  countOn: { backgroundColor: colors.orange },
  countZero: { backgroundColor: colors.textPlaceholder },
  countText: { fontFamily: fonts.black, fontSize: 11, color: colors.white },
  // 何段目の水やりか（2段目以降だけ出す）。右上の水やり数バッジとぶつからないよう左下に置く
  depthBadge: { position: 'absolute', bottom: -4, left: -4, paddingHorizontal: 5, height: 16, borderRadius: 8, backgroundColor: colors.green, justifyContent: 'center', borderWidth: 1.5, borderColor: colors.white },
  depthText: { fontFamily: fonts.bold, fontSize: 9, color: colors.white },
  // 「その他を見る」。実と区別しつつ、押せることが分かる見た目にする
  moreBubble: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.bgWarm, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  moreNum: { fontFamily: fonts.black, fontSize: 17, color: colors.textSecondary },
  newBadge: { position: 'absolute', top: -10, left: -8, backgroundColor: colors.green, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.white },
  newText: { fontFamily: fonts.black, fontSize: 8, color: colors.white, letterSpacing: 0.3 },
  nodeName: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textPrimary, marginTop: 6, maxWidth: NODE + 36, textAlign: 'center' },
  nodeOwner: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textSecondary, maxWidth: NODE + 36, textAlign: 'center' },
  emptyBubble: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2, borderColor: colors.greenSoftBorder, borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.65)', justifyContent: 'center', alignItems: 'center' },
  emptyPlus: { fontFamily: fonts.bold, fontSize: 26, color: colors.green, marginTop: -2 },
  emptyLabel: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textSecondary, marginTop: 5, textAlign: 'center', lineHeight: 13 },
  extraChip: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, ...shadows.soft },
  extraText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.orangeDeep },
  mascot: { position: 'absolute', left: 10, bottom: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  speech: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6, ...shadows.soft },
  speechText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.green },
});
