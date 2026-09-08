import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated';
import { colors, spacing, fonts, radius } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { FormError } from '@/components/ui/FormError';
import { cropToFrame, rotate90, type Ratio } from '@/lib/crop';
import { errorMessage } from '@/lib/errorMessage';

/**
 * 写真の切り抜き（2026-08-14 指摘）。
 *
 * これまでは「切り抜く」を押すと写真フォルダが開き、同じ写真をもう一度
 * 探して選び直さないと切り抜けなかった。ここでは追加済みの写真をそのまま扱う。
 *
 * 【操作】
 * 枠は固定で、写真の方を指で動かす（インスタと同じ）。
 * ドラッグで位置、ピンチで拡大。枠に収まっている部分がそのまま残る。
 *
 * 【なぜ枠を動かさないのか】
 * 枠を動かす方式だと「どこが残るのか」が枠の外まで見えてしまい分かりにくい。
 * 写真を動かす方式なら、見えているものがそのまま結果になる。
 *
 * 【回転】（2026-08-21 指摘）
 * 以前はヘッダー右に回転に見える丸矢印があったが、中身は位置のリセットで、
 * 横向きに撮れた写真を直す手段が無かった。回転を実装し、
 * リセットは「元に戻す」という文字のボタンに分けた（見た目と動きを一致させる）。
 */

const RATIOS: { key: Ratio; label: string }[] = [
  { key: 'square', label: '正方形' },
  { key: 'portrait', label: '3:4' },
  { key: 'landscape', label: '4:3' },
];

export default function CropScreen() {
  const { uri, ratio: initial } = useLocalSearchParams<{ uri: string; ratio?: string }>();
  const insets = useSafeAreaInsets();
  const [ratio, setRatio] = useState<Ratio>((initial as Ratio) ?? 'square');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 回転すると実ファイルが作り直されるので、表示・切り出しの対象はこちらを見る
  const [workUri, setWorkUri] = useState<string | undefined>(uri);
  const [rotating, setRotating] = useState(false);
  React.useEffect(() => { setWorkUri(uri); }, [uri]);

  // 表示中の写真の位置と倍率
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  // 切り出しの計算に使うので、JS 側にも最新値を持っておく
  const [view, setView] = useState({ x: 0, y: 0, s: 1 });
  const sync = (x: number, y: number, s: number) => setView({ x, y, s });

  const pan = Gesture.Pan()
    .onStart(() => { startX.value = tx.value; startY.value = ty.value; })
    .onUpdate((e) => { tx.value = startX.value + e.translationX; ty.value = startY.value + e.translationY; })
    .onEnd(() => { runOnJS(sync)(tx.value, ty.value, scale.value); });

  const pinch = Gesture.Pinch()
    .onStart(() => { startScale.value = scale.value; })
    .onUpdate((e) => { scale.value = Math.min(4, Math.max(1, startScale.value * e.scale)); })
    .onEnd(() => { runOnJS(sync)(tx.value, ty.value, scale.value); });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const reset = () => {
    tx.value = 0; ty.value = 0; scale.value = 1;
    setView({ x: 0, y: 0, s: 1 });
  };

  /**
   * 右に90度まわす。
   * 回すと写真の縦横が入れ替わるので、それまでの位置・倍率は意味を失う。
   * ずれたまま残ると「動かしていないのに切り出しがずれる」ので、あわせて戻す。
   */
  const rotate = async () => {
    if (!workUri || rotating) return;
    setRotating(true);
    setError(null);
    try {
      const out = await rotate90(workUri);
      setWorkUri(out);
      reset();
    } catch (e) {
      setError(errorMessage(e, '回転できませんでした'));
    } finally {
      setRotating(false);
    }
  };

  const apply = async () => {
    if (!workUri) return;
    setBusy(true);
    setError(null);
    try {
      const out = await cropToFrame(workUri, { ratio, frame: FRAME, tx: view.x, ty: view.y, scale: view.s });
      // 呼び出し元（出品・編集フォーム）が受け取れるよう、結果をパラメータで返す
      router.back();
      setTimeout(() => router.setParams({ cropped: out }), 0);
    } catch (e) {
      setError(errorMessage(e, '切り抜けませんでした'));
    } finally {
      setBusy(false);
    }
  };

  const h = ratio === 'square' ? FRAME : ratio === 'portrait' ? (FRAME * 4) / 3 : (FRAME * 3) / 4;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="close" size={26} color={colors.white} />
        </PressableScale>
        <Text style={styles.hTitle}>切り抜き</Text>
        {/* 回転（2026-08-21 指摘）。以前はここが見た目だけの丸矢印だった */}
        <PressableScale onPress={rotate} disabled={rotating} activeScale={0.9} style={styles.hBtn}>
          {rotating
            ? <ActivityIndicator color={colors.white} size="small" />
            : <MaterialIcons name="rotate-right" size={24} color={colors.white} />}
        </PressableScale>
      </View>

      <View style={styles.stage}>
        <GestureDetector gesture={gesture}>
          <View style={[styles.frame, { width: FRAME, height: h }]}>
            <Animated.View style={[StyleSheet.absoluteFill, animated]}>
              <Image source={{ uri: workUri }} style={styles.img} resizeMode="cover" />
            </Animated.View>
            {/* 三分割の目安線 */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={[styles.gridLine, { left: '33.3%', width: 1, top: 0, bottom: 0 }]} />
              <View style={[styles.gridLine, { left: '66.6%', width: 1, top: 0, bottom: 0 }]} />
              <View style={[styles.gridLine, { top: '33.3%', height: 1, left: 0, right: 0 }]} />
              <View style={[styles.gridLine, { top: '66.6%', height: 1, left: 0, right: 0 }]} />
            </View>
          </View>
        </GestureDetector>
        <Text style={styles.hint}>ドラッグで移動・2本指で拡大・右上で回転</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.ratioRow}>
          {RATIOS.map((r) => (
            <PressableScale
              key={r.key}
              activeScale={0.96}
              onPress={() => { setRatio(r.key); reset(); }}
              style={[styles.ratioChip, ratio === r.key && styles.ratioChipOn]}
            >
              <Text style={[styles.ratioText, ratio === r.key && styles.ratioTextOn]}>{r.label}</Text>
            </PressableScale>
          ))}
        </View>
        <PressableScale onPress={reset} activeScale={0.96} style={styles.resetBtn}>
          <Text style={styles.resetText}>位置と大きさを元に戻す</Text>
        </PressableScale>
        {error ? <FormError message={error} /> : null}
        <PressableScale onPress={apply} disabled={busy} activeScale={0.97} style={[styles.done, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.doneText}>この範囲で切り抜く</Text>}
        </PressableScale>
      </View>
    </View>
  );
}

/** 枠の幅（px）。高さは比率から決める */
const FRAME = 320;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111111' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  stage: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  frame: { overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#000000' },
  img: { width: '100%', height: '100%' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.28)' },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, gap: spacing.md },
  ratioRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  ratioChip: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  ratioChipOn: { backgroundColor: colors.white },
  ratioText: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  ratioTextOn: { fontFamily: fonts.bold, color: colors.textPrimary },
  resetBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: spacing.md },
  resetText: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' },
  done: { height: 54, borderRadius: radius.pill, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  doneText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
