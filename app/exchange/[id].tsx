import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Button } from '@/components/ui/Button';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { useExchange } from '@/hooks/useExchanges';
import { FormError } from '@/components/ui/FormError';
import { NotFound } from '@/components/ui/NotFound';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

/**
 * 発送前チェックリスト（2026-08-12 確定・6項目）。
 * 全部にチェックが入るまで「発送完了」を押せない。
 * 4番（食品）は該当時のみ確認する内容だが、表示は常に出す。
 */
const SHIP_CHECKS: { title: string; detail: string }[] = [
  { title: 'しっかり梱包しましたか？', detail: '配送中に傷や破損が起こらないように、適切な梱包をしましょう。' },
  { title: '出品時の状態と変わっていませんか？', detail: '汚れや破損がないか、もう一度確認してください。' },
  { title: '送料は発払いになっていますか？', detail: '着払いは受け取り側の負担になってしまうので、必ず発払いでお願いします。' },
  { title: '食品の場合、以下の条件を満たしていますか？', detail: '未開封であること／常温保存が可能なものに限る／賞味期限または消費期限が明記されているもの' },
  { title: '宛先の記載ミスはありませんか？', detail: '配送先の住所や氏名を間違えないよう、念のためもう一度確認しましょう。' },
  { title: '発送通知を忘れずに！', detail: '発送が完了したら、必ず発送完了ボタンを押してください。' },
];

export default function ExchangeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { trade, messages: msgs, busy, error, send, markShipped, markReceived, reload } = useExchange(id ?? '');
  // 画面に戻ったとき・アプリを前面に戻したときに最新を取り直す
  useAutoRefresh(reload, { intervalMs: 10000 });
  const [text, setText] = useState('');
  const [report, setReport] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => SHIP_CHECKS.map(() => false));
  const [received, setReceived] = useState(false);   // 受け取り完了のお知らせ
  const allChecked = checked.every(Boolean);

  if (!trade) return <NotFound message="この取引は見つかりませんでした" hint="取引が完了しているか、通知が古い可能性があります。取引一覧からご確認ください。" fallback="/exchange" />;
  const status = trade.status;
  // 商品名・相手名は取引の行が持っている（実DBでは UUID から引けない）
  const it = { name: trade.itemName, image: trade.itemImage ?? '', local: trade.itemLocal };
  const u = { nickname: trade.partnerName, avatar: trade.partnerAvatar };
  const isSend = trade.dir === 'send';
  const accent = isSend ? colors.orange : colors.green;

  // 受け取りは相手の発送後のみ可（滞留防止）。送るは未発送なら発送報告。
  const canReceive = !isSend && trade.status === 'shipped' && status !== 'received';
  const canShip = isSend && status === 'pending';
  const reportLabel = isSend ? '発送完了を報告する' : '受け取りを報告する';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>{u.nickname}さんとの取引</Text>
        <View style={styles.hBtn} />
      </View>

      {/* 商品バー */}
      <View style={[styles.itemBar, shadows.soft]}>
        <Thumb source={it.local} uri={it.image} style={styles.thumb} radius={radius.sm} markSize={22} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
          <Text style={[styles.dir, { color: accent }]}>{isSend ? 'あなたが送る商品' : 'あなたが受け取る商品'}</Text>
        </View>
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.chat}>
        {msgs.map((m) =>
          m.system ? (
            <View key={m.id} style={styles.system}>
              <Text style={styles.systemText}>{m.body}</Text>
            </View>
          ) : (
            <View key={m.id} style={[styles.msgRow, m.mine ? styles.mineRow : styles.theirsRow]}>
              <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.msgText, m.mine && { color: colors.white }]}>{m.body}</Text>
              </View>
              {m.createdAt ? <Text style={styles.msgTime}>{m.createdAt}</Text> : null}
            </View>
          )
        )}
      </ScrollView>

      {/* アクション */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }, shadows.sheet]}>
        {status === 'received' ? (
          <Button title="評価する" onPress={() => router.push(`/exchange/${id}/rating`)} />
        ) : canShip || canReceive ? (
          <Button title={reportLabel} variant={isSend ? 'accent' : 'primary'} onPress={() => setReport(true)} />
        ) : (
          <View style={styles.waitBox}>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.waitText}>相手の発送を待っています（発送後に受け取り報告ができます）</Text>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput value={text} onChangeText={setText} placeholder="メッセージを入力" placeholderTextColor={colors.textPlaceholder} style={styles.input} />
          {/* 空のときは押せないことが見て分かるように薄くする */}
          <PressableScale
            activeScale={0.9}
            disabled={!text.trim()}
            onPress={() => {
              send(text);
              setText('');
            }}
            style={[styles.send, { backgroundColor: accent }, !text.trim() && { opacity: 0.4 }]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </PressableScale>
        </View>
      </View>

      {/* 発送/受け取り報告 */}
      <BottomSheetModal visible={report} onClose={() => setReport(false)}>
        <View style={styles.reportCenter}>
          <View style={[styles.reportIcon, { backgroundColor: isSend ? colors.orangeSoft : colors.greenSoft }]}>
            <Ionicons name={isSend ? 'cube' : 'checkmark-done'} size={34} color={accent} />
          </View>
          <Text style={styles.reportTitle}>
            {isSend ? '📦 発送前に確認しよう！ 📦' : '商品を受け取りましたか？'}
          </Text>
          <Text style={styles.reportSub}>
            {isSend
              ? 'スムーズな取引のために、発送前に以下のチェックをお願いします！'
              : '受け取り報告をすると、相手に通知が届き、評価に進みます。'}
          </Text>
        </View>

        {isSend && (
          <ScrollView style={styles.checkList} showsVerticalScrollIndicator={false}>
            {SHIP_CHECKS.map((c, i) => (
              <PressableScale
                key={c.title}
                activeScale={0.99}
                onPress={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                style={styles.checkRow}
              >
                <View style={[styles.checkBox, checked[i] && styles.checkBoxOn]}>
                  {checked[i] && <Ionicons name="checkmark" size={15} color={colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkTitle}>{c.title}</Text>
                  <Text style={styles.checkDetail}>{c.detail}</Text>
                </View>
              </PressableScale>
            ))}
            <Text style={styles.checkOutro}>丁寧な発送で、気持ちの良い取引をお願いします！✨</Text>
          </ScrollView>
        )}

        {actionError ? <FormError message={actionError} /> : null}
        <Button
          title={isSend ? '発送完了を報告' : '受け取りを報告'}
          variant={isSend ? 'accent' : 'primary'}
          loading={busy}
          disabled={isSend && !allChecked}
          onPress={async () => {
            setActionError(null);
            const res = isSend ? await markShipped() : await markReceived();
            if (res.error) { setActionError(res.error); return; }
            setReport(false);
            if (!isSend) setReceived(true);   // 受け取り完了 → 評価へ促す
          }}
          style={{ marginTop: spacing.lg }}
        />
        {isSend && !allChecked && (
          <Text style={styles.checkHint}>すべて確認するとボタンを押せます</Text>
        )}
        <PressableScale onPress={() => setReport(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* 受け取り完了 → 評価へ促す（2026-08-12 指摘） */}
      <BottomSheetModal visible={received} onClose={() => setReceived(false)}>
        <View style={styles.reportCenter}>
          <View style={[styles.reportIcon, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="checkmark-circle" size={34} color={colors.green} />
          </View>
          <Text style={styles.reportTitle}>受け取り完了しました</Text>
          <Text style={styles.reportSub}>
            取引相手と商品の評価をお願いします。評価が揃うと取引が完了します。
          </Text>
        </View>
        <Button
          title="評価する"
          onPress={() => { setReceived(false); router.push(`/exchange/${id}/rating`); }}
          style={{ marginTop: spacing.lg }}
        />
        <PressableScale onPress={() => setReceived(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>あとで</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  checkList: { maxHeight: 320, marginTop: spacing.md },
  checkRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-start' },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  checkBoxOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  checkDetail: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  checkOutro: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  checkHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  itemBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: 20, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm },
  thumb: { width: 44, height: 44 },
  itemName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  dir: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  chat: { padding: 20, gap: spacing.md },
  system: { alignSelf: 'center', backgroundColor: colors.bgWarm, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 6, marginVertical: spacing.xs },
  systemText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  msgRow: { maxWidth: '80%', gap: 3 },
  mineRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirsRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 18 },
  mine: { backgroundColor: colors.green, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.card, borderBottomLeftRadius: 4, ...shadows.soft },
  msgText: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.textPrimary },
  msgTime: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.textPlaceholder, marginHorizontal: 4 },
  footer: { backgroundColor: colors.card, paddingHorizontal: 16, paddingTop: spacing.md, gap: spacing.md, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  waitBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md },
  waitText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minWidth: 0, backgroundColor: colors.cardMuted, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary },
  send: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  reportCenter: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  reportIcon: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  reportTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary },
  reportSub: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing.md },
  cancel: { alignItems: 'center', paddingVertical: spacing.lg },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
