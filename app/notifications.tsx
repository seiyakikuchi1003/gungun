import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Avatar } from '@/components/ui/Avatar';
import { NOTIF_ICON, NotificationType, Notif } from '@/data/mockSocial';
import { useNotifications } from '@/store/notifications';
import { notificationRoute } from '@/lib/notificationRoute';
import { useUsers } from '@/store/users';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

const TONE: Record<NotificationType, string> = {
  watered: colors.green,
  harvested: colors.orange,
  shipped: colors.orange,
  received: colors.green,
  message: colors.green,
  board_comment: colors.premium,
};

function Row({ n, onPress }: { n: Notif; onPress: () => void }) {
  const users = useUsers();
  const actor = n.actorId ? users.user(n.actorId) : null;
  return (
    <PressableScale onPress={onPress} activeScale={0.99} style={[styles.row, !n.read && styles.unread]}>
      <View style={styles.avatarWrap}>
        {actor ? <Avatar uri={actor.avatar} name={actor.nickname} size={44} /> : <View style={styles.avatarFallback} />}
        <View style={[styles.badge, { backgroundColor: TONE[n.type] }]}>
          <Ionicons name={NOTIF_ICON[n.type] as keyof typeof Ionicons.glyphMap} size={11} color={colors.white} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>
          {actor ? <Text style={styles.actor}>{actor.nickname}さん</Text> : null}
          {n.body}
        </Text>
        <Text style={styles.time}>{n.createdAt}</Text>
      </View>
      {!n.read && <View style={styles.dot} />}
    </PressableScale>
  );
}

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const { list, markRead, markAllRead, refresh } = useNotifications();
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
  const today = list.filter((n) => n.today);
  const earlier = list.filter((n) => !n.today);

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
        <PressableScale onPress={markAllRead} activeScale={0.94} style={styles.hBtn}>
          <Ionicons name="checkmark-done" size={22} color={colors.green} />
        </PressableScale>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.green]} tintColor={colors.green} />}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {today.length > 0 && (
          <>
            <Text style={styles.groupTitle}>今日</Text>
            {today.map((n) => <Row key={n.id} n={n} onPress={() => open(n)} />)}
          </>
        )}
        {earlier.length > 0 && (
          <>
            <Text style={styles.groupTitle}>これまで</Text>
            {earlier.map((n) => <Row key={n.id} n={n} onPress={() => open(n)} />)}
          </>
        )}
      </ScrollView>
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
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.bg },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  actor: { fontFamily: fonts.bold },
  time: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.heart },
});
