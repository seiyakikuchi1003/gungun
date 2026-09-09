import React, { useCallback, useState } from 'react';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { Thumb } from '@/components/ui/Thumb';
import { NOTIF_ICON, NotificationType, Notif } from '@/data/mockSocial';
import { useNotifications } from '@/store/notifications';
import { notificationRoute } from '@/lib/notificationRoute';
import { useUsers } from '@/store/users';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { Toast } from '@/components/ui/Toast';
import { lh } from '@/lib/fontScale';

/**
 * 種類ごとの色。
 *
 * DB 側に新しい通知種別を足したのにここへ足し忘れると、
 * 色が undefined になって行ごと壊れる（実際に 'sapling' で踏んだ）。
 * 取りこぼしても画面が出るよう、参照は tone() 経由にする。
 */
const TONE: Record<NotificationType, string> = {
  watered: colors.green,
  harvested: colors.orange,
  sapling: colors.green,
  shipped: colors.orange,
  received: colors.green,
  message: colors.green,
  board_comment: colors.premium,
  item_comment: colors.orange,
  ring_completed: colors.orangeDeep,
  rate_request: colors.green,
  item_like: colors.heart,
};

/** 知らない種別が来ても既定の色・アイコンで出す（DB が先行しても画面を壊さない） */
const tone = (t: NotificationType): string => TONE[t] ?? colors.green;
const icon = (t: NotificationType): keyof typeof Ionicons.glyphMap =>
  (NOTIF_ICON[t] ?? 'notifications') as keyof typeof Ionicons.glyphMap;

function Row({ n, onPress, onSave, onDelete, onBlockedDelete }: { n: Notif; onPress: () => void; onSave: () => void; onDelete: () => void; onBlockedDelete: () => void }) {
  const users = useUsers();
  const actor = n.actorId ? users.user(n.actorId) : null;
  return (
    <PressableScale onPress={onPress} activeScale={0.99} style={[styles.row, !n.read && styles.unread]}>
      <View style={styles.avatarWrap}>
        {/* 主役は「何についての通知か」＝関係する商品の写真。
            写真が無ければ相手のアイコン、それも無ければ種類の絵にする。
            種類は右下の小さなバッジで添える（2026-08-12） */}
        {n.imageUrl ? (
          <Thumb uri={n.imageUrl} style={styles.thumb} radius={22} markSize={18} />
        ) : n.actorAvatar || actor ? (
          <Avatar uri={n.actorAvatar ?? actor?.avatar} name={n.actorName ?? actor?.nickname} size={44} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: tone(n.type) + '22' }]}>
            <Ionicons name={icon(n.type)} size={20} color={tone(n.type)} />
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: tone(n.type) }]}>
          <Ionicons name={icon(n.type)} size={11} color={colors.white} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>
          {n.body}
        </Text>
        <Text style={styles.time}>{n.createdAt}</Text>
      </View>
      {/* 保存と削除。押し間違えないよう本文とは離して置く（2026-08-21 指摘） */}
      <View style={styles.rowActions}>
        {!n.read && <View style={styles.dot} />}
        <PressableScale onPress={onSave} activeScale={0.85} hitSlop={8} style={styles.rowBtn}>
          <Ionicons
            name={n.saved ? 'bookmark' : 'bookmark-outline'}
            size={17}
            color={n.saved ? colors.orange : colors.textSecondary}
          />
        </PressableScale>
        {/* 未読は消せない（2026-08-21 指摘）。押せないことが見て分かるよう薄くし、
            押されたときは理由を出す（黙って効かないのがいちばん困る） */}
        <PressableScale
          onPress={n.read ? onDelete : onBlockedDelete}
          activeScale={n.read ? 0.85 : 1}
          hitSlop={8}
          style={[styles.rowBtn, !n.read && styles.rowBtnOff]}
        >
          <Ionicons name="trash-outline" size={17} color={n.read ? colors.textSecondary : colors.textPlaceholder} />
        </PressableScale>
      </View>
    </PressableScale>
  );
}

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { list, markRead, markAllRead, remove, clearAll, toggleSaved, refresh } = useNotifications();
  // 画面に戻ったとき・アプリを前面に戻したときに最新を取り直す
  useAutoRefresh(refresh, { intervalMs: 20000 });
  // 引っ張って更新（他の画面と同じ操作で最新にできるように）
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // 取得に失敗しても画面は保つ
    }
    setRefreshing(false);
  }, [refresh]);
  // 保存したものは日付に関係なく先頭にまとめる
  const saved = list.filter((n) => n.saved);
  const rest = list.filter((n) => !n.saved);
  const today = rest.filter((n) => n.today);
  const earlier = rest.filter((n) => !n.today);

  // タップしたら既読にして、その通知が指す画面へ飛ぶ
  const open = (n: Notif) => {
    if (!n.read) markRead(n.id);
    router.push(notificationRoute(n.type, n.relatedId) as never);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>通知</Text>
        <View style={styles.hRight}>
          <PressableScale onPress={markAllRead} activeScale={0.94} style={styles.hBtn}>
            <Ionicons name="checkmark-done" size={22} color={colors.green} />
          </PressableScale>
          {/* 保存したものは残す。うっかり大事なものまで消さないため */}
          <PressableScale onPress={() => setConfirmClear(true)} activeScale={0.94} style={styles.hBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
          </PressableScale>
        </View>
      </View>

      <BottomSheetModal visible={confirmClear} onClose={() => setConfirmClear(false)}>
        <Text style={styles.clearTitle}>通知をまとめて消しますか？</Text>
        <Text style={styles.clearBody}>
          読み終わった通知だけを消します。{'\n'}
          未読の通知と保存した通知は残ります。消した通知は元に戻せません。
        </Text>
        <PressableScale
          onPress={() => { clearAll(); setConfirmClear(false); }}
          activeScale={0.97}
          style={styles.clearBtn}
        >
          <Text style={styles.clearBtnText}>まとめて消す</Text>
        </PressableScale>
        <PressableScale onPress={() => setConfirmClear(false)} activeScale={0.98} style={styles.clearCancel}>
          <Text style={styles.clearCancelText}>やめる</Text>
        </PressableScale>
      </BottomSheetModal>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.green]} tintColor={colors.green} />}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {saved.length > 0 && (
          <>
            <Text style={styles.groupTitle}>保存した通知</Text>
            {saved.map((n) => (
              <Row key={n.id} n={n} onPress={() => open(n)} onSave={() => toggleSaved(n.id)} onDelete={() => remove(n.id)} onBlockedDelete={() => setToast('未読の通知は消せません。開いて確認すると消せます')} />
            ))}
          </>
        )}

        {today.length > 0 && (
          <>
            <Text style={styles.groupTitle}>今日</Text>
            {today.map((n) => (
              <Row key={n.id} n={n} onPress={() => open(n)} onSave={() => toggleSaved(n.id)} onDelete={() => remove(n.id)} onBlockedDelete={() => setToast('未読の通知は消せません。開いて確認すると消せます')} />
            ))}
          </>
        )}
        {earlier.length > 0 && (
          <>
            <Text style={styles.groupTitle}>これまで</Text>
            {earlier.map((n) => (
              <Row key={n.id} n={n} onPress={() => open(n)} onSave={() => toggleSaved(n.id)} onDelete={() => remove(n.id)} onBlockedDelete={() => setToast('未読の通知は消せません。開いて確認すると消せます')} />
            ))}
          </>
        )}
      </ScrollView>

      <Toast message={toast} onHide={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  groupTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 20, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  unread: { backgroundColor: colors.bgWarm },
  avatarWrap: { width: 44, height: 44 },
  thumb: { width: 44, height: 44 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.bg },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: lh(20), color: colors.textPrimary },
  actor: { fontFamily: fonts.bold },
  time: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: 3 },
  hRight: { flexDirection: 'row', alignItems: 'center' },
  clearTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' },
  clearBody: { fontFamily: fonts.medium, fontSize: 13, lineHeight: lh(20), color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  clearBtn: { minHeight: 52, borderRadius: radius.pill, backgroundColor: '#E5484D', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  clearBtnText: { flexShrink: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.white, },
  clearCancel: { alignItems: 'center', paddingVertical: spacing.lg },
  clearCancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary },
  rowBtnOff: { opacity: 0.5 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowBtn: { padding: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.heart },
});
