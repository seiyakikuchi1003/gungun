import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { PressableScale } from '@/components/ui/PressableScale';
import { success } from '@/lib/haptics';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 何を通報するか（見出しに使う） */
  targetLabel?: string;
};

const REASONS = [
  '不適切・規約違反の内容',
  '偽物・詐欺のおそれ',
  'スパム・宣伝',
  '取引と関係のない出品',
  'その他',
];

/**
 * 通報シート（商品・投稿で共通）。
 * 理由を選び「その他」なら自由記述、送信すると受付完了を表示する。
 * ネイティブ化時は Supabase `reports` テーブルへ INSERT する。
 */
export function ReportSheet({ visible, onClose, targetLabel = 'この内容' }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [done, setDone] = useState(false);

  const close = () => {
    onClose();
    // 次に開いたときのため少し遅らせて状態リセット
    setTimeout(() => { setReason(null); setDetail(''); setDone(false); }, 250);
  };

  const submit = () => {
    if (!reason) return;
    success();
    setDone(true);
  };

  return (
    <BottomSheetModal visible={visible} onClose={close}>
      {done ? (
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={30} color={colors.white} />
          </View>
          <Text style={styles.doneTitle}>通報を受け付けました</Text>
          <Text style={styles.doneNote}>
            ご報告ありがとうございます。運営が内容を確認します。
          </Text>
          <PressableScale onPress={close} activeScale={0.97} style={[styles.submit, shadows.button]}>
            <Text style={styles.submitText}>閉じる</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{targetLabel}を通報</Text>
          <Text style={styles.note}>理由を選んでください</Text>
          <View style={styles.reasons}>
            {REASONS.map((r) => {
              const on = reason === r;
              return (
                <PressableScale
                  key={r}
                  onPress={() => setReason(r)}
                  activeScale={0.98}
                  style={[styles.reason, on && styles.reasonOn]}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on && <Ionicons name="checkmark" size={13} color={colors.white} />}
                  </View>
                  <Text style={[styles.reasonText, on && styles.reasonTextOn]}>{r}</Text>
                </PressableScale>
              );
            })}
          </View>
          {reason === 'その他' && (
            <TextInput
              value={detail}
              onChangeText={setDetail}
              placeholder="内容を入力してください"
              placeholderTextColor={colors.textPlaceholder}
              multiline
              style={[styles.input, { outlineStyle: 'none' } as object]}
            />
          )}
          <PressableScale
            onPress={submit}
            disabled={!reason}
            activeScale={0.97}
            style={[styles.submit, shadows.button, !reason && styles.submitOff]}
          >
            <Text style={styles.submitText}>通報する</Text>
          </PressableScale>
        </>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' },
  note: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  reasons: { gap: spacing.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  reasonOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: colors.green, backgroundColor: colors.green },
  reasonText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.textPrimary },
  reasonTextOn: { fontFamily: fonts.bold, color: colors.green },
  input: { marginTop: spacing.md, minHeight: 80, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.cardMuted, borderRadius: radius.md, padding: spacing.md, textAlignVertical: 'top' },
  submit: { height: 54, borderRadius: radius.pill, backgroundColor: colors.orangeDeep, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  submitOff: { backgroundColor: colors.textPlaceholder, opacity: 0.6 },
  submitText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  doneWrap: { alignItems: 'center', paddingVertical: spacing.md },
  doneIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  doneTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  doneNote: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: spacing.lg },
});
