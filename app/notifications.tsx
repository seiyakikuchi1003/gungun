import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { notifications, NOTIF_ICON, NotificationType } from '@/data/mockSocial';

const TONE: Record<NotificationType, string> = {
  watered: colors.green,
  harvested: colors.orange,
  shipped: colors.orange,
  received: colors.green,
  message: colors.green,
  board_comment: colors.premium,
};

export default function Notifications() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>通知</Text>
        <View style={styles.hBtn} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {notifications.map((n) => (
          <PressableScale key={n.id} activeScale={0.99} style={[styles.row, !n.read && styles.unread]}>
            <View style={[styles.icon, { backgroundColor: TONE[n.type] + '22' }]}>
              <Ionicons name={NOTIF_ICON[n.type] as keyof typeof Ionicons.glyphMap} size={20} color={TONE[n.type]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{n.body}</Text>
              <Text style={styles.time}>{n.createdAt}</Text>
            </View>
            {!n.read && <View style={styles.dot} />}
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 20, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  unread: { backgroundColor: colors.bgWarm },
  icon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  time: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.heart },
});
