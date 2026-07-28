import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Thumb } from '@/components/ui/Thumb';
import { Avatar } from '@/components/ui/Avatar';
import { StarRating } from '@/components/ui/StarRating';
import { PhotoSourceSheet } from '@/components/feature/PhotoSourceSheet';
import { getUser, categories, conditions } from '@/data/mock';
import { success } from '@/lib/haptics';
import { playSfx } from '@/lib/sound';
import { useTree } from '@/store/tree';
import { settings } from '@/config/settings';

const NAME_MAX = 20;
const DESC_MAX = 200;
type PickerKey = 'category' | 'condition' | null;

export default function WaterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getItem, canWater, water, fertilizer, settings: appSettings, live } = useTree();
  const target = getItem(id ?? '');

  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('バッグ・小物');
  const [condition, setCondition] = useState('');
  const [picker, setPicker] = useState<PickerKey>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!target) {
    return (
      <View style={styles.notFound}><Text style={styles.notFoundText}>商品が見つかりません</Text></View>
    );
  }

  const owner = getUser(target.ownerId);
  const gate = canWater(target.id);
  // 水やり単価は DB（app_settings）から。未接続時はモックの既定値
  const cost = live ? appSettings.waterCost : settings.waterCost;
  const formOk = name.trim().length > 0 && condition.length > 0 && photos.length > 0;
  const canSubmit = gate.ok && formOk && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    // 実DB接続時は写真のアップロードとRPCが走るため少し待つ
    const created = await water(target.id, { name, category, condition, description: desc, photos });
    setBusy(false);
    if (created) {
      success(); // 水やり成立の「タタン♪」
      playSfx('chime'); // ピロン↑
      router.replace({ pathname: '/tree/[rootId]', params: { rootId: created.rootId, new: created.id } });
    }
  };

  return (
    <View style={styles.root}>
      {/* ヘッダー */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </PressableScale>
        <Text style={styles.hTitle}>水やり（自分の商品を出品）</Text>
        <PressableScale onPress={() => router.push('/water/about')} activeScale={0.9} style={styles.hBtn}>
          <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* 水やり先（親商品） */}
        <Text style={styles.label}>水やり先（親商品）</Text>
        <View style={[styles.parentCard, shadows.soft]}>
          <Thumb source={target.local} uri={target.image} style={styles.parentThumb} radius={radius.md} markSize={26} />
          <View style={{ flex: 1 }}>
            <Text style={styles.parentName} numberOfLines={1}>{target.name}</Text>
            <View style={styles.parentMeta}>
              <Avatar uri={owner.avatar} name={owner.nickname} size={18} />
              <Text style={styles.parentOwner}>{owner.nickname}さん</Text>
            </View>
            <View style={styles.parentMeta}>
              <StarRating value={4.5} size={12} gap={1} />
              <Text style={styles.parentSub}>(12)　水やり数：{target.waterCount}</Text>
            </View>
          </View>
        </View>

        {/* あなたが出す商品（子） */}
        <Text style={[styles.label, { marginTop: spacing.xl, color: colors.waterBlue }]}>あなたが出す商品（子）</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((uri, i) => (
            <View key={uri + i} style={styles.photo}>
              <Thumb uri={uri} style={styles.photoImg} radius={radius.md} markSize={30} />
              <PressableScale onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} style={styles.removeBadge} activeScale={0.85}>
                <Ionicons name="close" size={13} color={colors.white} />
              </PressableScale>
            </View>
          ))}
          <PressableScale onPress={() => setPhotoSheet(true)} activeScale={0.96} style={styles.addPhoto}>
            <Ionicons name="camera" size={26} color={colors.waterBlue} />
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

        {/* カテゴリ */}
        <SelectRow label="カテゴリ" value={category} placeholder="バッグ・小物" onPress={() => setPicker('category')} />
        {/* 商品の状態 */}
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
            style={[styles.input, styles.textarea, { outlineStyle: 'none' } as object]}
          />
        </View>

        {/* 肥料 */}
        <View style={styles.costBox}>
          <View style={styles.costRow}>
            <View style={styles.costLabelRow}>
              <Ionicons name="water" size={16} color={colors.waterBlue} />
              <Text style={styles.costLabel}>必要な肥料</Text>
            </View>
            <Text style={styles.costValue}>{cost} 肥料</Text>
          </View>
          <View style={styles.costRow}>
            <View style={styles.costLabelRow}>
              <Ionicons name="leaf" size={16} color={colors.green} />
              <Text style={styles.costLabel}>残高</Text>
            </View>
            <Text style={styles.costValue}>{fertilizer} 肥料</Text>
          </View>
        </View>

        {/* 水やり不可の理由 */}
        {!gate.ok && (
          <View style={styles.warnBox}>
            <Ionicons name="alert-circle" size={16} color={colors.orangeDeep} />
            <Text style={styles.warnText}>{gate.reason}</Text>
          </View>
        )}
      </ScrollView>

      {/* 水やりするボタン */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <PressableScale onPress={submit} disabled={!canSubmit} activeScale={0.97} style={[styles.waterBtn, shadows.button, !canSubmit && styles.waterBtnOff]}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="water" size={20} color={colors.white} />
              <Text style={styles.waterText}>水やりする</Text>
            </>
          )}
        </PressableScale>
        <Text style={styles.footerHint}>水やりすると、あなたの商品がこの木の子として出品されます</Text>
      </View>

      {/* 写真の追加方法（カメラ / ライブラリ） */}
      <PhotoSourceSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        onPicked={(uris) => setPhotos((p) => [...p, ...uris].slice(0, 10))}
      />

      {/* ピッカー */}
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
      <PressableScale onPress={onPress} activeScale={0.98} style={[styles.select, { outlineStyle: 'none' } as object]}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </PressableScale>
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
  parentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.md },
  parentThumb: { width: 60, height: 60 },
  parentName: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  parentMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  parentOwner: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  parentSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  photoRow: { gap: spacing.md, paddingVertical: spacing.xs },
  photo: { width: 92, height: 92 },
  photoImg: { width: 92, height: 92 },
  removeBadge: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  addPhoto: { width: 92, height: 92, borderRadius: radius.md, borderWidth: 2, borderColor: colors.waterBlueSoft, borderStyle: 'dashed', backgroundColor: colors.waterBlueBg, justifyContent: 'center', alignItems: 'center', gap: 2 },
  addPhotoText: { fontFamily: fonts.bold, fontSize: 11, color: colors.waterBlue },
  field: { marginTop: spacing.lg, gap: spacing.sm },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
  counter: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textPlaceholder },
  input: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  selectValue: { fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  selectPlaceholder: { color: colors.textPlaceholder },
  costBox: { backgroundColor: colors.card, borderRadius: radius.card, padding: spacing.lg, marginTop: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  costLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  costLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary },
  costValue: { fontFamily: fonts.black, fontSize: 15, color: colors.textPrimary },
  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  warnText: { flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.orangeDeep },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.divider, ...shadows.sheet },
  waterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.pill, backgroundColor: colors.waterBlue },
  waterBtnOff: { backgroundColor: colors.textPlaceholder, opacity: 0.6 },
  waterText: { fontFamily: fonts.bold, fontSize: 17, color: colors.white },
  footerHint: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  pickerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickerText: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.textPrimary },
  pickerTextOn: { fontFamily: fonts.bold, color: colors.green },
});
