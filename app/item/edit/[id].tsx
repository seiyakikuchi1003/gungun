import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Thumb } from '@/components/ui/Thumb';
import { PhotoSourceSheet } from '@/components/feature/PhotoSourceSheet';
import { categories, conditions } from '@/data/mock';
import { useMe } from '@/store/me';
import { FormError } from '@/components/ui/FormError';
import { success } from '@/lib/haptics';
import { useTree } from '@/store/tree';
import { KeyboardDoneBar, KEYBOARD_DONE_ID } from '@/components/ui/KeyboardDoneBar';
import { NotFound } from '@/components/ui/NotFound';

const NAME_MAX = 20;
const DESC_MAX = 200;
type PickerKey = 'category' | 'condition' | null;

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getItem, updateItem } = useTree();
  const me = useMe();
  const item = getItem(id ?? '');

  // 既存の写真（URI優先。ローカル画像しかない場合はサムネのみ表示できないので空で開始）
  const initialPhotos = item ? (item.images?.length ? item.images : item.image ? [item.image] : []) : [];
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [name, setName] = useState(item?.name ?? '');
  const [desc, setDesc] = useState(item?.description ?? '');
  const [category, setCategory] = useState(item?.category ?? categories[0]);
  const [condition, setCondition] = useState(item?.condition ?? '');
  const [picker, setPicker] = useState<PickerKey>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) {
    return <NotFound message="商品が見つかりませんでした" />;
  }
  // 念のため他人の商品は編集不可
  if (item.ownerId !== me.id) {
    return <NotFound message="この出品は編集できません" hint="取引中または収穫済みの商品は編集できません。" />;
  }

  const canSave = name.trim().length > 0 && condition.length > 0 && photos.length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setError(null);
    setBusy(true);
    const res = await updateItem(item.id, { name, category, condition, description: desc, photos });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    success();
    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>出品を編集</Text>
        <View style={styles.hBtn} />
      </View>

      <ScrollView
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* 写真 */}
        <Text style={styles.label}>商品の写真</Text>
        <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((uri, i) => (
            <View key={uri + i} style={styles.photo}>
              <Thumb source={i === 0 ? item.local : undefined} uri={uri} style={styles.photoImg} radius={radius.md} markSize={30} />
              <PressableScale onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} style={styles.removeBadge} activeScale={0.85}>
                <Ionicons name="close" size={13} color={colors.white} />
              </PressableScale>
            </View>
          ))}
          <PressableScale onPress={() => setPhotoSheet(true)} activeScale={0.96} style={styles.addPhoto}>
            <Ionicons name="camera" size={26} color={colors.green} />
            <Text style={styles.addPhotoText}>写真を追加</Text>
          </PressableScale>
        </ScrollView>

        {/* 商品名 */}
        <View style={styles.field}>
          <View style={styles.fieldHead}>
            <Text style={styles.fieldLabel}>商品名</Text>
            <Text style={styles.counter}>{name.length}/{NAME_MAX}</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={(t) => t.length <= NAME_MAX && setName(t)}
            placeholder="入力してください（20文字以内）"
            placeholderTextColor={colors.textPlaceholder}
            style={[styles.input, { outlineStyle: 'none' } as object]}
          />
        </View>

        <SelectRow label="カテゴリ" value={category} placeholder="選択してください" onPress={() => setPicker('category')} />
        <SelectRow label="商品の状態" value={condition} placeholder="選択してください" onPress={() => setPicker('condition')} />

        {/* 商品説明 */}
        <View style={styles.field}>
          <View style={styles.fieldHead}>
            <Text style={styles.fieldLabel}>商品説明</Text>
            <Text style={styles.counter}>{desc.length}/{DESC_MAX}</Text>
          </View>
          <TextInput
            value={desc}
            onChangeText={(t) => t.length <= DESC_MAX && setDesc(t)}
            placeholder="商品の説明を入力してください（200文字以内）"
            placeholderTextColor={colors.textPlaceholder}
            multiline
              inputAccessoryViewID={KEYBOARD_DONE_ID}
            style={[styles.input, styles.textarea, { outlineStyle: 'none' } as object]}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {error ? <View style={{ marginBottom: 10 }}><FormError message={error} /></View> : null}
        <PressableScale onPress={save} disabled={!canSave} activeScale={0.97} style={[styles.saveBtn, shadows.button, !canSave && styles.saveBtnOff]}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={styles.saveText}>変更を保存</Text>
            </>
          )}
        </PressableScale>
      </View>

      <PhotoSourceSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        onPicked={(uris) => setPhotos((p) => [...p, ...uris].slice(0, 10))}
      />

      <BottomSheetModal visible={picker !== null} onClose={() => setPicker(null)}>
        <Text style={styles.pickerTitle}>{picker === 'category' ? 'カテゴリ' : '商品の状態'}</Text>
        {(picker === 'category' ? categories : conditions).map((opt) => {
          const selected = picker === 'category' ? category === opt : condition === opt;
          return (
            <PressableScale key={opt} activeScale={0.98} onPress={() => { picker === 'category' ? setCategory(opt) : setCondition(opt); setPicker(null); }} style={styles.pickerRow}>
              <Text style={[styles.pickerText, selected && styles.pickerTextOn]}>{opt}</Text>
              {selected && <Ionicons name="checkmark" size={20} color={colors.green} />}
            </PressableScale>
          );
        })}
      </BottomSheetModal>
    </View>
  );
}

function SelectRow({ label, value, placeholder, onPress }: { label: string; value: string; placeholder: string; onPress: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <PressableScale onPress={onPress} activeScale={0.98} style={styles.select}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </PressableScale>
      <KeyboardDoneBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  notFoundText: { fontFamily: fonts.medium, color: colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: spacing.sm },
  hBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  hTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  photoRow: { gap: spacing.md, paddingVertical: spacing.xs },
  photo: { width: 92, height: 92 },
  photoImg: { width: 92, height: 92 },
  removeBadge: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  addPhoto: { width: 92, height: 92, borderRadius: radius.md, borderWidth: 2, borderColor: colors.greenSoftBorder, borderStyle: 'dashed', backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', gap: 2 },
  addPhotoText: { fontFamily: fonts.bold, fontSize: 11, color: colors.green },
  field: { marginTop: spacing.lg, gap: spacing.sm },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  counter: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textPlaceholder },
  input: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  selectValue: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  selectPlaceholder: { color: colors.textPlaceholder },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.divider, ...shadows.sheet },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.green },
  saveBtnOff: { backgroundColor: colors.textPlaceholder, opacity: 0.6 },
  saveText: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  pickerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickerText: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.textPrimary },
  pickerTextOn: { fontFamily: fonts.bold, color: colors.green },
});
