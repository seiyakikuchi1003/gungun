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
import { CARRIERS, carrier as carrierOf, carrierLabel, checkNumber, prettyNumber, trackingUrl } from '@/lib/tracking';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { currentStep, nextAction } from '@/lib/exchangeStatus';
import { success } from '@/lib/haptics';
import { Linking, TextInput } from 'react-native';
import { lh } from '@/lib/fontScale';

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
  const { detail, loading, busy, reload, markShipped, markReceived, cancel, saveTracking } = useExchangeDetail(id ?? '');
  useAutoRefresh(reload, { intervalMs: 15000 });

  const [shipSheet, setShipSheet] = useState(false);
  const [recvSheet, setRecvSheet] = useState(false);
  const [donePopup, setDonePopup] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => SHIP_CHECKS.map(() => false));
  // 配送情報（2026-08-14 指摘：配送後のフローを細かく）
  const [carrier, setCarrier] = useState<string>('yamato');
  const [tracking, setTracking] = useState('');
  // 取引の取り消し（2026-08-14 指摘）
  const [cancelSheet, setCancelSheet] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // 発送後の追跡番号の訂正（2026-08-17）
  const [trackSheet, setTrackSheet] = useState(false);
  const allChecked = checked.every(Boolean);
  // 「その他・追跡なし」以外は追跡番号を必ず入れてもらう（2026-08-21 指摘）
  const trackingReady = carrier === 'other' || checkNumber(carrier, tracking).ok;

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

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {/* 通知から開いたときに取引一覧へ飛ばされると、通知の続きが読めなくなる。
            来た道があればそこへ戻す（2026-08-21 指摘） */}
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/exchange'))}
          activeScale={0.9}
          style={styles.hBtn}
        >
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

        {/* 配送状況。発送後だけ出す。
            番号そのものを押せるようにして、追跡サイトへ直接飛べるようにする（2026-08-17） */}
        {detail.status !== 'pending' && (
          <View style={[styles.panel, shadows.soft]}>
            <View style={styles.panelHead}>
              <Text style={styles.panelLabel}>配送状況</Text>
              {detail.iAmSender && detail.status === 'shipped' && (
                <PressableScale onPress={() => setTrackSheet(true)} activeScale={0.95} style={styles.copyBtn}>
                  <Ionicons name="create-outline" size={14} color={colors.green} />
                  <Text style={styles.copyText}>訂正</Text>
                </PressableScale>
              )}
            </View>

            {detail.trackingNumber ? (
              <>
                <View style={styles.trackCard}>
                  <View style={styles.trackTop}>
                    <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.trackCarrier}>{carrierLabel(detail.trackingCarrier)}</Text>
                  </View>
                  <Text style={styles.trackNoLabel}>追跡番号</Text>
                  {(() => {
                    const url = trackingUrl(detail.trackingCarrier, detail.trackingNumber);
                    const body = (
                      <Text style={[styles.trackNo, url && styles.trackNoLink]}>
                        {prettyNumber(detail.trackingNumber)}
                      </Text>
                    );
                    return url ? (
                      <PressableScale activeScale={0.97} onPress={() => Linking.openURL(url).catch(() => {})}>
                        {body}
                      </PressableScale>
                    ) : (
                      body
                    );
                  })()}
                </View>

                {(() => {
                  const url = trackingUrl(detail.trackingCarrier, detail.trackingNumber);
                  if (!url) {
                    return (
                      <Text style={styles.trackHint}>
                        この配送業者は、アプリから追跡ページを開けません。番号を控えて業者のサイトでご確認ください。
                      </Text>
                    );
                  }
                  return (
                    <PressableScale
                      activeScale={0.97}
                      onPress={() => Linking.openURL(url).catch(() => {})}
                      style={styles.trackLink}
                    >
                      <Ionicons name="open-outline" size={16} color={colors.white} />
                      <Text style={styles.trackLinkText}>
                        {carrierLabel(detail.trackingCarrier)}のサイトで追跡する
                      </Text>
                    </PressableScale>
                  );
                })()}
              </>
            ) : (
              <Text style={styles.addrNone}>
                {detail.iAmSender
                  ? '追跡番号は登録されていません。「訂正」から追加できます。'
                  : '追跡番号は登録されていません。気になるときは取引メッセージで相手に聞いてみてください。'}
              </Text>
            )}
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
        {/* 見出しからチェック・追跡番号までをまとめて流す。
            ボタンはこの外に置き、どれだけ項目が増えても押せる位置に残す（2026-08-21 指摘） */}
        <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.sheetCenter}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.orangeSoft }]}>
            <Ionicons name="cube" size={34} color={colors.orange} />
          </View>
          <Text style={styles.sheetTitle}>📦 発送前に確認しよう！ 📦</Text>
          <Text style={styles.sheetSub}>スムーズな取引のために、発送前に以下のチェックをお願いします！</Text>
        </View>

        <View>
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
        </View>

        {/* 配送業者と追跡番号。受け取る側が「今どこか」を追えるようにする */}
        <View style={styles.trackBox}>
          <Text style={styles.trackLabel}>配送業者と追跡番号</Text>
          <View style={styles.carrierRow}>
            {CARRIERS.map((c) => (
              <PressableScale
                key={c.key}
                activeScale={0.96}
                onPress={() => { setCarrier(c.key); setTracking(''); }}
                style={[styles.carrierChip, carrier === c.key && styles.carrierChipOn]}
              >
                <Text style={[styles.carrierText, carrier === c.key && styles.carrierTextOn]}>{c.label}</Text>
              </PressableScale>
            ))}
          </View>
          {carrier !== 'other' && (
            <>
              <TextInput
                value={tracking}
                onChangeText={setTracking}
                placeholder={`例：${carrierOf(carrier)?.sample ?? ''}`}
                placeholderTextColor={colors.textPlaceholder}
                keyboardType="number-pad"
                style={[styles.trackInput, { outlineStyle: 'none' } as object]}
              />
              {/* 桁数が違うまま追跡サイトへ送ると、開いた先でエラーになる。
                  入力した本人がその場で気づけるようにする（2026-08-17） */}
              {(() => {
                const v = checkNumber(carrier, tracking);
                if (tracking.trim() === '') {
                  return (
                    <Text style={styles.trackNg}>
                      追跡番号を入力してください。番号が出ない発送方法なら「その他・追跡なし」を選んでください。
                    </Text>
                  );
                }
                return v.ok ? (
                  <Text style={styles.trackOk}>この番号で追跡できます</Text>
                ) : (
                  <Text style={styles.trackNg}>{v.reason}</Text>
                );
              })()}
            </>
          )}
        </View>
        </ScrollView>

        {actionError ? <FormError message={actionError} /> : null}
        <Button
          title="発送完了を報告"
          variant="accent"
          loading={busy}
          disabled={!allChecked || !trackingReady}
          onPress={async () => {
            setActionError(null);
            const res = await markShipped(carrier, tracking);
            if (res.error) { setActionError(res.error); return; }
            setShipSheet(false);
          }}
          style={{ marginTop: spacing.lg }}
        />
        {(!allChecked || !trackingReady) && (
          <Text style={styles.checkHint}>
            {!allChecked ? 'すべて確認するとボタンを押せます' : '追跡番号を入力すると押せます'}
          </Text>
        )}
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

      {/* 追跡番号の訂正（発送した本人・受け取り前のみ） */}
      <BottomSheetModal visible={trackSheet} onClose={() => setTrackSheet(false)}>
        <View style={styles.sheetCenter}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.greenSoft }]}>
            <Ionicons name="cube-outline" size={34} color={colors.green} />
          </View>
          <Text style={styles.sheetTitle}>追跡番号を直す</Text>
          <Text style={styles.sheetSub}>
            {detail.partnerName}さんはこの番号で荷物を追います。伝票のとおりに入力してください。
          </Text>
        </View>

        <View style={styles.carrierRow}>
          {CARRIERS.map((c) => (
            <PressableScale
              key={c.key}
              activeScale={0.96}
              onPress={() => { setCarrier(c.key); setTracking(''); }}
              style={[styles.carrierChip, carrier === c.key && styles.carrierChipOn]}
            >
              <Text style={[styles.carrierText, carrier === c.key && styles.carrierTextOn]}>{c.label}</Text>
            </PressableScale>
          ))}
        </View>
        {carrier !== 'other' && (
          <>
            <TextInput
              value={tracking}
              onChangeText={setTracking}
              placeholder={`例：${carrierOf(carrier)?.sample ?? ''}`}
              placeholderTextColor={colors.textPlaceholder}
              keyboardType="number-pad"
              style={[styles.trackInput, { outlineStyle: 'none' } as object, { marginTop: spacing.sm }]}
            />
            {tracking.trim() !== '' &&
              (checkNumber(carrier, tracking).ok ? (
                <Text style={styles.trackOk}>この番号で追跡できます</Text>
              ) : (
                <Text style={styles.trackNg}>
                  {(checkNumber(carrier, tracking) as { reason: string }).reason}
                </Text>
              ))}
          </>
        )}

        {actionError ? <FormError message={actionError} /> : null}
        <Button
          title="保存する"
          loading={busy}
          disabled={carrier !== 'other' && !checkNumber(carrier, tracking).ok}
          onPress={async () => {
            setActionError(null);
            const res = await saveTracking(carrier, tracking);
            if (res.error) { setActionError(res.error); return; }
            setTrackSheet(false);
          }}
          style={{ marginTop: spacing.lg }}
        />
        <PressableScale onPress={() => setTrackSheet(false)} style={styles.cancel}>
          <Text style={styles.cancelText}>やめる</Text>
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
            この輪に入っている全員の取引が取り消され、商品は出品中に戻ります。参加者にはその旨が通知されます。取り消しは元に戻せません。
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
  addrLine: { fontFamily: fonts.medium, fontSize: 13, lineHeight: lh(20), color: colors.textSecondary },
  addrNone: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: lh(19), color: colors.textSecondary },

  ringLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 48, borderRadius: radius.pill, backgroundColor: colors.orangeSoft,
  },
  ringLinkText: { fontFamily: fonts.bold, fontSize: 14, color: colors.orangeDeep },

  sheetCenter: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sheetIcon: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'center' },
  // 短い一言は中央のまま。長い説明は左揃えにして行頭をそろえる（2026-08-21 指摘）
  sheetSub: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, lineHeight: lh(22), alignSelf: 'stretch' },
  // 320 だと最後の項目とボタンが同時に見えず、下まであることに気づけなかった
  // （2026-08-13 指摘）。画面の高さに応じて伸ばす
  sheetBody: { flexShrink: 1, marginBottom: spacing.md },
  checkRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-start' },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkBoxOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, lineHeight: lh(20) },
  checkDetail: { fontFamily: fonts.medium, fontSize: 12, lineHeight: lh(18), color: colors.textSecondary, marginTop: 2 },
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
  trackHint: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: lh(18), color: colors.textSecondary },
  trackOk: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.green },
  trackNg: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: lh(18), color: '#E5484D' },
  trackCard: { backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  trackTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackCarrier: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary },
  trackNoLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  trackNo: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: 0.5, color: colors.textPrimary },
  trackNoLink: { color: colors.green, textDecorationLine: 'underline' },
  trackLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 46, borderRadius: radius.pill, backgroundColor: colors.green, marginTop: spacing.sm,
  },
  trackLinkText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
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
