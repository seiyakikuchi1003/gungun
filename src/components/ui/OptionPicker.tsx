import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, radius } from '@/theme';
import { BottomSheetModal } from './BottomSheetModal';
import { PressableScale } from './PressableScale';

/**
 * 選択肢から1つ選ぶシート。項目が多いときのために絞り込みを付けている。
 * カテゴリー・商品の状態で共用（2026-08-12：カテゴリーに検索が欲しいとの指摘）。
 */
export function OptionPicker({
  visible,
  title,
  options,
  selected,
  searchable = false,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected?: string;
  searchable?: boolean;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const k = q.trim();
    return k ? options.filter((o) => o.includes(k)) : options;
  }, [q, options]);

  const close = () => {
    onClose();
    setTimeout(() => setQ(''), 250);
  };

  return (
    <BottomSheetModal visible={visible} onClose={close}>
      <Text style={styles.title}>{title}</Text>

      {searchable && (
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="絞り込む"
            placeholderTextColor={colors.textPlaceholder}
            style={[styles.searchInput, { outlineStyle: 'none' } as object]}
          />
        </View>
      )}

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {list.map((opt) => {
          const on = selected === opt;
          return (
            <PressableScale
              key={opt}
              activeScale={0.98}
              onPress={() => { onSelect(opt); close(); }}
              style={styles.row}
            >
              <Text style={[styles.text, on && styles.textOn]}>{opt}</Text>
              {on && <Ionicons name="checkmark" size={20} color={colors.green} />}
            </PressableScale>
          );
        })}
        {list.length === 0 && <Text style={styles.empty}>見つかりませんでした</Text>}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.cardMuted, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, height: 42, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  list: { maxHeight: 360 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  text: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.textPrimary },
  textOn: { fontFamily: fonts.bold, color: colors.green },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
});
