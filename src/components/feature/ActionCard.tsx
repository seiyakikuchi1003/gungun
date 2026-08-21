import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TONE, type Action } from '@/lib/exchangeStatus';

/**
 * 「次にやること」を1枚のカードで出す（docs/gungun-retool-adopt.md 1-5）。
 *
 * 取引画面でいちばん困るのは「自分の番なのか、待ちなのか」が分からないこと。
 * 状態と役割から決めた1つの案内だけをここに出し、他の選択肢は下に置かない。
 */
export function ActionCard({ action, onPress, busy }: {
  action: Action;
  onPress: () => void;
  busy?: boolean;
}) {
  const tone = TONE[action.tone];
  return (
    <View style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.card }]}>
          <Ionicons name={action.icon as never} size={20} color={tone.icon} />
        </View>
        <Text style={[styles.title, { color: tone.text }]}>{action.title}</Text>
      </View>
      <Text style={styles.body}>{action.body}</Text>

      {action.cta && (
        <PressableScale
          onPress={onPress}
          activeScale={0.97}
          disabled={busy}
          style={[
            styles.cta,
            { backgroundColor: action.tone === 'brand' ? colors.green : colors.card },
            action.tone !== 'brand' && { borderWidth: 1, borderColor: tone.border },
            busy && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.ctaText, action.tone !== 'brand' && { color: tone.text }]}>
            {action.cta}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 15.5 },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  cta: {
    height: 50, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center',
    marginTop: spacing.xs,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.white },
});
