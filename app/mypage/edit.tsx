import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, fonts, radius, shadows } from '@/theme';
import { PressableScale } from '@/components/ui/PressableScale';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useMe } from '@/store/me';
import { FormError } from '@/components/ui/FormError';
import { useAuth } from '@/store/auth';
import { isSupabaseEnabled } from '@/lib/supabase';
import { updateProfile } from '@/lib/api/profile';
import { pickFromLibrary } from '@/lib/photo';

export default function ProfileEdit() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const { reloadProfile, profile } = useAuth();
  const [nickname, setNickname] = useState(me.nickname);
  const [bio, setBio] = useState(profile?.bio ?? '不要になったものを、必要な人へ🌱 気軽に水やりしてください！');
  const [avatar, setAvatar] = useState<string | number>(me.avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** アイコン写真を選び直す */
  const changeAvatar = async () => {
    const picked = await pickFromLibrary();
    if (picked?.[0]) setAvatar(picked[0]);
  };

  const save = async () => {
    if (busy) return;
    if (!nickname.trim()) { setError('ニックネームを入力してください'); return; }
    if (!isSupabaseEnabled || !me.live) { router.back(); return; }
    setError(null);
    setBusy(true);
    try {
      await updateProfile(me.id, { nickname, bio });
      await reloadProfile();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} activeScale={0.9}><Text style={styles.cancel}>キャンセル</Text></PressableScale>
        <Text style={styles.hTitle}>プロフィール編集</Text>
        <PressableScale onPress={save} activeScale={0.94} disabled={busy}>
          <Text style={styles.save}>{busy ? '保存中…' : '保存'}</Text>
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={styles.avatarWrap}>
          <Avatar uri={avatar} name={nickname} size={96} />
          <PressableScale onPress={changeAvatar} activeScale={0.9} style={[styles.camera, shadows.button]}>
            <Ionicons name="camera" size={18} color={colors.white} />
          </PressableScale>
        </View>

        {error ? <View style={{ marginBottom: 12 }}><FormError message={error} /></View> : null}

        <View style={styles.form}>
          <TextField label="ニックネーム" value={nickname} onChangeText={setNickname} />
          <View>
            <Text style={styles.label}>自己紹介</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="自己紹介を書きましょう"
              placeholderTextColor={colors.textPlaceholder}
              style={[styles.bio, shadows.soft]}
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button title="変更を保存する" loading={busy} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  cancel: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  hTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  save: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  avatarWrap: { alignSelf: 'center', marginVertical: spacing.xl },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: colors.bg },
  form: { gap: spacing.lg },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm },
  bio: { backgroundColor: colors.card, borderRadius: radius.input, padding: spacing.lg, minHeight: 100, textAlignVertical: 'top', fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary },
  footer: { paddingHorizontal: 20, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
});
