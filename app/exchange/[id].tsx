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
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

export default function ExchangeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { trade, messages: msgs, busy, error, send, markShipped, markReceived, reload } = useExchange(id ?? '');
  // 画面に戻ったとき・アプリを前面に戻したときに最新を取り直す
  useAutoRefresh(reload, { intervalMs: 10000 });
  const [text, setText] = useState('');
  const [report, setReport] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!trade) return <View style={styles.root} />;
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
          <Text style={styles.reportTitle}>{isSend ? '発送完了を報告しますか？' : '商品を受け取りましたか？'}</Text>
          <Text style={styles.reportSub}>
            {isSend ? '相手に発送完了の通知が届きます。' : '受け取り報告をすると、相手に通知が届き、評価に進みます。'}
          </Text>
        </View>
        {actionError ? <FormError message={actionError} /> : null}
        <Button
          title={isSend ? '発送完了を報告' : '受け取りを報告'}
          variant={isSend ? 'accent' : 'primary'}
          loading={busy}
          onPress={async () => {
            setActionError(null);
            const res = isSend ? await markShipped() : await markReceived();
            if (res.error) { setActionError(res.error); return; }
            setReport(false);
          }}
          style={{ marginTop: spacing.lg }}
        />
        <PressableScale onPress={() => setReport(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
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
