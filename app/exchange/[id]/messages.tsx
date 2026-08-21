import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { Thumb } from '@/components/ui/Thumb';
import { NotFound } from '@/components/ui/NotFound';
import { useExchange } from '@/hooks/useExchanges';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

/**
 * 取引メッセージ（2026-08-13 項目8で取引詳細から分離）。
 *
 * もとは取引を開くといきなりこの画面だったが、
 * 「今どの段階か・次に何をするか」が分からないという指摘を受けて詳細画面を親にした。
 * ここはやり取りに専念する。
 *
 * 相手の発言はポーリングではなく Realtime で受ける（retool-adopt 1-6）。
 * 取りこぼしたときのために、画面に戻ったときの再取得も残してある。
 */
export default function ExchangeMessages() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { trade, messages: msgs, send, reload } = useExchange(id ?? '');
  const [text, setText] = useState('');
  const scroller = useRef<ScrollView>(null);

  // 新しい発言が入ったら最後まで送る
  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [msgs.length]);

  // 相手の発言を即時に受け取る
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !id) return;
    const ch = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `exchange_id=eq.${id}` },
        () => { reload(); }
      )
      .subscribe();
    return () => { supabase?.removeChannel(ch); };
  }, [id, reload]);

  if (!trade) {
    return <NotFound message="この取引は見つかりませんでした" fallback="/exchange" />;
  }

  const isSend = trade.dir === 'send';
  const accent = isSend ? colors.orange : colors.green;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle} numberOfLines={1}>{trade.partnerName}さんとのメッセージ</Text>
        <View style={styles.hBtn} />
      </View>

      {/* どの取引の話か分かるように商品を出しておく */}
      <PressableScale
        activeScale={0.98}
        onPress={() => router.back()}
        style={[styles.itemBar, shadows.soft]}
      >
        <Thumb source={trade.itemLocal} uri={trade.itemImage ?? ''} style={styles.thumb} radius={radius.sm} markSize={22} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>{trade.itemName}</Text>
          <Text style={[styles.dir, { color: accent }]}>{isSend ? 'あなたが送る商品' : 'あなたが受け取る商品'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </PressableScale>

      <ScrollView
        ref={scroller}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.chat}
      >
        {msgs.length === 0 && (
          <Text style={styles.empty}>
            まだメッセージはありません。ひとこと挨拶を送ると、やり取りがスムーズになります。
          </Text>
        )}
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

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }, shadows.sheet]}>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="メッセージを入力"
            placeholderTextColor={colors.textPlaceholder}
            style={[styles.input, { outlineStyle: 'none' } as object]}
            multiline
          />
          <PressableScale
            activeScale={0.9}
            disabled={!text.trim()}
            onPress={() => { send(text); setText(''); }}
            style={[styles.send, { backgroundColor: accent }, !text.trim() && { opacity: 0.4 }]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  itemBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: 20, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm },
  thumb: { width: 44, height: 44 },
  itemName: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  dir: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  chat: { padding: 20, gap: spacing.md },
  empty: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
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
  footer: { backgroundColor: colors.card, paddingHorizontal: 16, paddingTop: spacing.md, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1, minWidth: 0, maxHeight: 120, backgroundColor: colors.cardMuted, borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary },
  send: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
