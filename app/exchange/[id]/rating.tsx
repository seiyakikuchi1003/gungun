import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { ZoomIn, FadeIn } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { Avatar } from '@/components/ui/Avatar';
import { Mikan } from '@/components/art/Mikan';
import { useExchange } from '@/hooks/useExchanges';
import { FormError } from '@/components/ui/FormError';

const GOOD = ['対応が丁寧', 'スムーズ', '説明通り', '発送が早い', '梱包が丁寧'];

export default function RatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { trade, busy, rate } = useExchange(id ?? '');
  const [score, setScore] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!trade) return <View style={styles.root} />;
  const u = { nickname: trade.partnerName, avatar: trade.partnerAvatar };
  const isSend = trade.dir === 'send';

  const submit = async () => {
    if (score === 0 || busy) return;
    setError(null);
    // 選んだタグも本文に添えて残す（DB は comment 1本なので連結する）
    const body = [tags.join('・'), comment.trim()].filter(Boolean).join('\n');
    const res = await rate(score, body);
    if (res.error) { setError(res.error); return; }
    setDone(true);
  };
  // 送った側→やり取りの円滑さ / 受け取った側→商品の質
  const question = isSend ? 'やり取りはスムーズでしたか？' : '商品の状態はいかがでしたか？';

  if (done) {
    return (
      <View style={[styles.root, styles.doneWrap]}>
        <Animated.View entering={ZoomIn.springify().damping(11)}><Mikan size={120} /></Animated.View>
        <Animated.Text entering={FadeIn.delay(150)} style={styles.doneTitle}>評価を送信しました！</Animated.Text>
        <Animated.Text entering={FadeIn.delay(250)} style={styles.doneSub}>取引完了です。ありがとうございました🌱</Animated.Text>
        <Button title="取引一覧へ戻る" onPress={() => router.replace('/exchange')} style={{ marginTop: spacing['2xl'], width: '80%' }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>評価</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.userCard}>
          <Avatar uri={u.avatar} name={u.nickname} size={64} />
          <Text style={styles.userName}>{u.nickname}さん</Text>
          <Text style={styles.badge}>{isSend ? 'やり取りの評価' : '商品の質の評価'}</Text>
        </View>

        <Text style={styles.question}>{question}</Text>
        <View style={styles.starWrap}>
          <StarRating value={score} onChange={setScore} size={40} gap={10} />
        </View>

        <Text style={styles.tagLabel}>よかった点（任意）</Text>
        <View style={styles.tags}>
          {GOOD.map((t) => {
            const on = tags.includes(t);
            return (
              <PressableScale key={t} activeScale={0.95} onPress={() => setTags((s) => (on ? s.filter((x) => x !== t) : [...s, t]))} style={[styles.tag, on && styles.tagOn]}>
                <Text style={[styles.tagText, on && styles.tagTextOn]}>{t}</Text>
              </PressableScale>
            );
          })}
        </View>

        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="コメントを書く（任意）"
          placeholderTextColor={colors.textPlaceholder}
          multiline
          style={[styles.comment, shadows.soft]}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {error ? <View style={{ marginBottom: 12 }}><FormError message={error} /></View> : null}
        <Button title="評価を送信する" disabled={score === 0} loading={busy} onPress={submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  userCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  userName: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginTop: spacing.sm },
  badge: { fontFamily: fonts.bold, fontSize: 12, color: colors.green, backgroundColor: colors.greenSoft, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  question: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  starWrap: { alignItems: 'center', marginVertical: spacing.xl },
  tagLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card, ...shadows.soft },
  tagOn: { backgroundColor: colors.green },
  tagText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  tagTextOn: { color: colors.white, fontFamily: fonts.bold },
  comment: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, minHeight: 100, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  doneWrap: { justifyContent: 'center', alignItems: 'center', padding: 30 },
  doneTitle: { fontFamily: fonts.bold, fontSize: 21, color: colors.textPrimary, marginTop: spacing.lg },
  doneSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
});
