import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { FormError } from '@/components/ui/FormError';
import { NotFound } from '@/components/ui/NotFound';
import { Stepper } from '@/components/feature/Stepper';
import { ActionCard } from '@/components/feature/ActionCard';
import { useExchangeDetail } from '@/hooks/useExchangeDetail';
import { CARRIERS, carrierLabel, trackingUrl } from '@/lib/tracking';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { currentStep, nextAction } from '@/lib/exchangeStatus';
import { success } from '@/lib/haptics';
import { shareText } from '@/lib/share';
import { Linking, TextInput } from 'react-native';

/**
 * 取引詳細（2026-08-13 項目8 ／ docs/gungun-retool-adopt.md 1-5）。
 *
 * これまでは取引を開くといきなりチャットで、
 * 「誰と・何を・今どの段階か・次に何を押すか」がどこにも書いていなかった。
 *
 * この画面の役割は3つだけ：
 *   1. ステッパーで今の段階を示す
 *   2. ActionCard で「次にやること」を1つだけ出す
 *   3. 商品と宛先を確認できるようにする
 * メッセージは別画面（/exchange/[id]/messages）に分けた。
 */

/** 発送前チェックリスト（2026-08-12 確定・6項目）。全部チェックで発送報告できる */
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
  const { detail, loading, busy, reload, markShipped, markReceived, cancel } = useExchangeDetail(id ?? '');
  useAutoRefresh(reload, { intervalMs: 15000 });

  const [shipSheet, setShipSheet] = useState(false);
  const [recvSheet, setRecvSheet] = useState(false);
  const [donePopup, setDonePopup] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => SHIP_CHECKS.map(() => false));
  const [copied, setCopied] = useState(false);
  // 配送情報（2026-08-14 指摘：配送後のフローを細かく）
  const [carrier, setCarrier] = useState<string>('yamato');
  const [tracking, setTracking] = useState('');
  // 取引の取り消し（2026-08-14 指摘）
  const [cancelSheet, setCancelSheet] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const allChecked = checked.every(Boolean);

  if (loading) {
    return <View style={[styles.root, styles.center]}><ActivityIndicator color={colors.green} /></View>;
  }
  if (!detail) {
    return (
      <NotFound
        message="この取引は見つかりませんでした"
        hint="取引が完了しているか、通知が古い可能性があります。取引一覧からご確認ください。"
        fallback="/exchange"
      />
    );
  }

  const action = nextAction({
    status: detail.status,
    iAmSender: detail.iAmSender,
    iRated: detail.iRated,
    partnerRated: detail.partnerRated,
    partnerName: detail.partnerName,
    hasMyAddress: !!detail.myAddress,
  });

  const onAction = () => {
    setActionError(null);
    switch (action.kind) {
      case 'ship': setShipSheet(true); break;
      case 'receive': setRecvSheet(true); break;
      case 'rate': router.push(`/exchange/${id}/rating`); break;
      case 'ring': router.push(`/celebration/${detail.harvestId}`); break;
      case 'address': router.push('/address'); break;
      default: break;
    }
  };

  // 宛名書きのときに使えるよう、住所をまとめて書き出す。
  // 「共有」と書くと何が起きるか伝わらなかったので「住所をコピー」に改めた（2026-08-13 指摘）。
  // expo-clipboard を足すとネイティブビルドが必要になるため、
  // 実機では OS の共有シート（コピーを含む）、Web ではクリップボードに入る
  const copyAddress = async () => {
    const a = detail.shipTo;
    if (!a) return;
    const res = await shareText(`〒${a.postal}\n${a.address}\n${a.name} 様\n${a.phone}`);
    if (res === 'cancelled') return;
    setCopied(true);
    success();
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.dismissTo('/exchange')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>取引の詳細</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: spacing.lg }}>
        {/* 今どの段階か */}
        <View style={[styles.panel, shadows.soft]}>
          <Stepper current={currentStep(detail.status, detail.iRated, detail.partnerRated)} />
        </View>

        {/* 次にやること */}
        <ActionCard action={action} onPress={onAction} busy={busy} />
        {actionError ? <FormError message={actionError} /> : null}

        {/* 誰と取引しているか */}
        <View style={[styles.panel, shadows.soft]}>
          <Text style={styles.panelLabel}>取引相手</Text>
          <PressableScale
            activeScale={0.98}
            onPress={() => router.push(`/user/${detail.partnerId}`)}
            style={styles.partnerRow}
          >
            <Avatar uri={detail.partnerAvatar ?? undefined} name={detail.partnerName} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerName}>{detail.partnerName}さん</Text>
              <Text style={styles.partnerRole}>
                {detail.iAmSender ? 'この商品を受け取る人' : 'この商品を送ってくれる人'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </PressableScale>

          <PressableScale
            activeScale={0.98}
            onPress={() => router.push(`/exchange/${id}/messages`)}
            style={styles.msgLink}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.green} />
            <Text style={styles.msgLinkText}>取引メッセージ</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.green} />
          </PressableScale>
        </View>

        {/* 何を取引しているか */}
        <View style={[styles.panel, shadows.soft]}>
          <Text style={styles.panelLabel}>{detail.iAmSender ? 'あなたが送る商品' : 'あなたが受け取る商品'}</Text>
          <PressableScale
            activeScale={0.98}
            onPress={() => router.push(`/item/${detail.itemId}`)}
            style={styles.itemRow}
          >
            <Thumb source={undefined} uri={detail.itemImage ?? undefined} style={styles.thumb} radius={radius.md} markSize={22} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.itemName} numberOfLines={2}>{detail.itemName}</Text>
              {!!detail.itemCondition && (
                <View style={styles.condTag}><Text style={styles.condText}>{detail.itemCondition}</Text></View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </PressableScale>
        </View>

        {/* 宛先。発送する人にだけ相手の住所を出す */}
        {detail.iAmSender && (
          <View style={[styles.panel, shadows.soft]}>
            <View style={styles.panelHead}>
              <Text style={styles.panelLabel}>お届け先（{detail.partnerName}さん）</Text>
              {detail.shipTo && (
                <PressableScale onPress={copyAddress} activeScale={0.95} style={styles.copyBtn}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={colors.green} />
                  <Text style={styles.copyText}>{copied ? 'コピーしました' : '住所をコピー'}</Text>
                </PressableScale>
              )}
            </View>
            {detail.shipTo ? (
              <View style={styles.addr}>
                <Text style={styles.addrName}>{detail.shipTo.name} 様</Text>
                <Text style={styles.addrLine}>〒{detail.shipTo.postal}</Text>
                <Text style={styles.addrLine}>{detail.shipTo.address}</Text>
                {!!detail.shipTo.phone && <Text style={styles.addrLine}>{detail.shipTo.phone}</Text>}
              </View>
            ) : (
              <Text style={styles.addrNone}>
                相手のお届け先がまだ登録されていません。登録されるまで発送できません。
              </Text>
            )}
          </View>
        )}

        {/* 配送状況。発送後だけ出す */}
        {detail.status !== 'pending' && !!detail.trackingCarrier && (
          <View style={[styles.panel, shadows.soft]}>
            <Text style={styles.panelLabel}>配送状況</Text>
            <View style={styles.addr}>
              <Text style={styles.addrName}>{carrierLabel(detail.trackingCarrier)}</Text>
              <Text style={styles.addrLine}>
                {detail.trackingNumber ? `追跡番号 ${detail.trackingNumber}` : '追跡番号の登録はありません'}
              </Text>
            </View>
            {(() => {
              const url = trackingUrl(detail.trackingCarrier, detail.trackingNumber);
              if (!url) return null;
              return (
                <PressableScale
                  activeScale={0.97}
                  onPress={() => Linking.openURL(url).catch(() => {})}
                  style={styles.trackLink}
                >
                  <Ionicons name="open-outline" size={16} color={colors.green} />
                  <Text style={styles.trackLinkText}>配送状況を確認する</Text>
                </PressableScale>
              );
            })()}
          </View>
        )}

        {/* 自分の住所。差出人として書くもの／届く先として確認するもの */}
        <View style={[styles.panel, shadows.soft]}>
          <View style={styles.panelHead}>
            <Text style={styles.panelLabel}>
              {detail.iAmSender ? 'あなたの住所（差出人）' : 'あなたのお届け先'}
            </Text>
            <PressableScale onPress={() => router.push('/address')} activeScale={0.95} style={styles.copyBtn}>
              <Ionicons name="create-outline" size={14} color={colors.green} />
              <Text style={styles.copyText}>編集</Text>
            </PressableScale>
          </View>
          {detail.myAddress ? (
            <View style={styles.addr}>
              <Text style={styles.addrName}>{detail.myAddress.name}</Text>
              <Text style={styles.addrLine}>〒{detail.myAddress.postal}</Text>
              <Text style={styles.addrLine}>{detail.myAddress.address}</Text>
              {!!detail.myAddress.phone && <Text style={styles.addrLine}>{detail.myAddress.phone}</Text>}
            </View>
          ) : (
            <Text style={styles.addrNone}>
              まだ登録されていません。{detail.iAmSender ? '発送するには登録が必要です。' : '商品が届かなくなるので登録をお願いします。'}
            </Text>
          )}
        </View>

        {/* まだ誰も発送していないうちは取り消せる（2026-08-14 指摘）。
            発送後は物が動いているので、ここには出さず運営対応にする */}
        {detail.status === 'pending' && (
          <PressableScale onPress={() => setCancelSheet(true)} activeScale={0.98} style={styles.cancelLink}>
            <Text style={styles.cancelLinkText}>この取引を取り消す</Text>
          </PressableScale>
        )}

        {/* 輪の全体 */}
        {!!detail.harvestId && (
          <PressableScale
            onPress={() => router.push(`/celebration/${detail.harvestId}`)}
            activeScale={0.97}
            style={styles.ringLink}
          >
            <Ionicons name="repeat" size={16} color={colors.orange} />
            <Text style={styles.ringLinkText}>この取引が入っている輪を見る</Text>
          </PressableScale>
        )}
      </ScrollView>

      {/* 発送報告 */}
      <BottomSheetModal visible={shipSheet} onClose={() => setShipSheet(false)}>
        <View style={styles.sheetCenter}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.orangeSoft }]}>
            <Ionicons name="cube" size={34} color={colors.orange} />
          </View>
          <Text style={styles.sheetTitle}>📦 発送前に確認しよう！ 📦</Text>
          <Text style={styles.sheetSub}>スムーズな取引のために、発送前に以下のチェックをお願いします！</Text>
        </View>

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

        {/* 配送業者と追跡番号。受け取る側が「今どこか」を追えるようにする */}
        <View style={styles.trackBox}>
          <Text style={styles.trackLabel}>配送業者と追跡番号（任意）</Text>
          <View style={styles.carrierRow}>
            {CARRIERS.map((c) => (
              <PressableScale
                key={c.key}
                activeScale={0.96}
                onPress={() => setCarrier(c.key)}
                style={[styles.carrierChip, carrier === c.key && styles.carrierChipOn]}
              >
                <Text style={[styles.carrierText, carrier === c.key && styles.carrierTextOn]}>{c.label}</Text>
              </PressableScale>
            ))}
          </View>
          {carrier !== 'other' && (
            <TextInput
              value={tracking}
              onChangeText={setTracking}
              placeholder="追跡番号（数字のみ）"
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
              style={[styles.trackInput, { outlineStyle: 'none' } as object]}
            />
          )}
        </View>

        {actionError ? <FormError message={actionError} /> : null}
        <Button
          title="発送完了を報告"
          variant="accent"
          loading={busy}
          disabled={!allChecked}
          onPress={async () => {
            setActionError(null);
            const res = await markShipped(carrier, tracking);
            if (res.error) { setActionError(res.error); return; }
            setShipSheet(false);
          }}
          style={{ marginTop: spacing.lg }}
        />
        {!allChecked && <Text style={styles.checkHint}>すべて確認するとボタンを押せます</Text>}
        <PressableScale onPress={() => setShipSheet(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* 受け取り報告 */}
      <BottomSheetModal visible={recvSheet} onClose={() => setRecvSheet(false)}>
        <View style={styles.sheetCenter}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="checkmark-done" size={34} color={colors.green} />
          </View>
          <Text style={styles.sheetTitle}>商品を受け取りましたか？</Text>
          <Text style={styles.sheetSub}>
            受け取り報告をすると、{detail.partnerName}さんに通知が届き、評価に進みます。
          </Text>
        </View>
        {actionError ? <FormError message={actionError} /> : null}
        <Button
          title="受け取りを報告"
          loading={busy}
          onPress={async () => {
            setActionError(null);
            const res = await markReceived();
            if (res.error) { setActionError(res.error); return; }
            setRecvSheet(false);
            setDonePopup(true);
          }}
          style={{ marginTop: spacing.lg }}
        />
        <PressableScale onPress={() => setRecvSheet(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* 取引の取り消し */}
      <BottomSheetModal visible={cancelSheet} onClose={() => setCancelSheet(false)}>
        <View style={styles.sheetCenter}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.cardMuted }]}>
            <Ionicons name="close-circle-outline" size={34} color={colors.textSecondary} />
          </View>
          <Text style={styles.sheetTitle}>この取引を取り消しますか？</Text>
          <Text style={styles.sheetSub}>
            この輪に入っている全員の取引が取り消され、商品は出品中に戻ります。{'\n'}
            参加者にはその旨が通知されます。取り消しは元に戻せません。
          </Text>
        </View>
        <TextInput
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="理由（任意・相手に伝わります）"
          placeholderTextColor={colors.textPlaceholder}
          style={[styles.trackInput, { outlineStyle: 'none' } as object]}
        />
        {actionError ? <FormError message={actionError} /> : null}
        <PressableScale
          activeScale={0.97}
          disabled={busy}
          onPress={async () => {
            setActionError(null);
            const res = await cancel(detail.harvestId, cancelReason);
            if (res.error) { setActionError(res.error); return; }
            setCancelSheet(false);
            router.dismissTo('/exchange');
          }}
          style={[styles.dangerBtn, busy && { opacity: 0.6 }]}
        >
          <Text style={styles.dangerText}>取り消す</Text>
        </PressableScale>
        <PressableScale onPress={() => setCancelSheet(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>やめる</Text>
        </PressableScale>
      </BottomSheetModal>

      {/* 受け取り完了 → 評価へ促す */}
      <BottomSheetModal visible={donePopup} onClose={() => setDonePopup(false)}>
        <View style={styles.sheetCenter}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="checkmark-circle" size={34} color={colors.green} />
          </View>
          <Text style={styles.sheetTitle}>受け取り完了しました</Text>
          <Text style={styles.sheetSub}>取引相手と商品の評価をお願いします。評価が揃うと取引が完了します。</Text>
        </View>
        <Button
          title="評価する"
          onPress={() => { setDonePopup(false); router.push(`/exchange/${id}/rating`); }}
          style={{ marginTop: spacing.lg }}
        />
        <PressableScale onPress={() => setDonePopup(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>あとで</Text>
        </PressableScale>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },

  panel: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },

  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  partnerName: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary },
  partnerRole: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  msgLink: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.greenSoft, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44,
    marginTop: spacing.xs,
  },
  msgLinkText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.greenDeep },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 64, height: 64 },
  itemName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  condTag: { alignSelf: 'flex-start', backgroundColor: colors.cardMuted, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  condText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },

  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  copyText: { fontFamily: fonts.bold, fontSize: 12, color: colors.green },
  addr: { gap: 3, backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md },
  addrName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary },
  addrLine: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  addrNone: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },

  ringLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 48, borderRadius: radius.pill, backgroundColor: colors.orangeSoft,
  },
  ringLinkText: { fontFamily: fonts.bold, fontSize: 14, color: colors.orangeDeep },

  sheetCenter: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sheetIcon: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'center' },
  sheetSub: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing.md },
  // 320 だと最後の項目とボタンが同時に見えず、下まであることに気づけなかった
  // （2026-08-13 指摘）。画面の高さに応じて伸ばす
  checkList: { maxHeight: 440, marginTop: spacing.md },
  checkRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-start' },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkBoxOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  checkDetail: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  checkOutro: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  checkHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  trackBox: { gap: spacing.sm, marginTop: spacing.md },
  trackLabel: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },
  carrierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  carrierChip: {
    paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  carrierChipOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  carrierText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  carrierTextOn: { fontFamily: fonts.bold, color: colors.greenDeep },
  trackInput: {
    backgroundColor: colors.cardMuted, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, height: 46,
    fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary,
  },
  trackLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: radius.pill, backgroundColor: colors.greenSoft, marginTop: spacing.xs,
  },
  trackLinkText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.greenDeep },
  cancelLink: { alignItems: 'center', paddingVertical: spacing.md },
  cancelLinkText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' },
  dangerBtn: {
    height: 52, borderRadius: radius.pill, backgroundColor: '#E5484D',
    justifyContent: 'center', alignItems: 'center', marginTop: spacing.md,
  },
  dangerText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  cancel: { alignItems: 'center', paddingVertical: spacing.lg },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
});
