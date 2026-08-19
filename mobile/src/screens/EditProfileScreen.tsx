// mobile/src/screens/EditProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { colors, typography, spacing } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { AVATARS } from '../config/avatars';

type MusicGenre = 'rap' | 'rnb' | 'rock' | 'pop' | 'jazz' | 'classical' | 'electro' | 'reggae' | 'metal' | 'country';
type Visibility = 'public' | 'friends-only' | 'private';
type VisibilityField = 'username' | 'bio' | 'musicPreferences';

const GENRES: MusicGenre[] = ['rap', 'rnb', 'rock', 'pop', 'jazz', 'classical', 'electro', 'reggae', 'metal', 'country'];
const VISIBILITIES: Visibility[] = ['public', 'friends-only', 'private'];
const FIELDS: { key: VisibilityField; label: string }[] = [
  { key: 'username', label: 'Username' },
  { key: 'bio', label: 'Bio' },
  { key: 'musicPreferences', label: 'Music preferences' },
];

export default function EditProfileScreen({ navigation }: any) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [visibility, setVisibility] = useState<Record<VisibilityField, Visibility>>({
    username: 'public', bio: 'public', musicPreferences: 'public',
  });
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/users/me', token)
      .then((me) => {
        setBio(me.bio ?? '');
        setGenres(me.musicpreferences ?? []);
        setVisibility((v) => ({ ...v, ...(me.visibilitySettings ?? {}) }));
        setAvatar(me.avatar || null);
      })
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleGenre(g: MusicGenre) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch('/users/me', token, {
        method: 'PATCH',
        body: JSON.stringify({ bio, musicpreferences: genres, visibilitySettings: visibility, avatar: avatar ?? '' }),
      });
      Alert.alert('Saved', 'Profile updated');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={typography.h1}>Edit profile</Text>

      <Text style={[typography.h2, styles.section]}>Avatar</Text>
      <View style={styles.avatars}>
        {AVATARS.map((a) => {
          const active = avatar === a.id;
          return (
            <TouchableOpacity
              key={a.id}
              onPress={() => setAvatar(a.id)}
              style={[styles.avatarPick, active && styles.avatarPickActive]}
            >
              <Image source={a.source} style={styles.avatarPickImg} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[typography.h2, styles.section]}>Bio</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
        placeholder="Tell something about you..." placeholderTextColor={colors.textSecondary}
        value={bio} onChangeText={setBio} multiline maxLength={255}
      />

      <Text style={[typography.h2, styles.section]}>Music preferences</Text>
      <View style={styles.chips}>
        {GENRES.map((g) => {
          const active = genres.includes(g);
          return (
            <TouchableOpacity key={g} onPress={() => toggleGenre(g)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[typography.h2, styles.section]}>Visibility</Text>
      {FIELDS.map((f) => (
        <View key={f.key} style={styles.visRow}>
          <Text style={[typography.body, { marginBottom: spacing.xs }]}>{f.label}</Text>
          <View style={styles.segment}>
            {VISIBILITIES.map((v) => {
              const active = visibility[f.key] === v;
              return (
                <TouchableOpacity key={v} onPress={() => setVisibility((s) => ({ ...s, [f.key]: v }))}
                  style={[styles.segItem, active && styles.segItemActive]}>
                  <Text style={[styles.segText, active && styles.segTextActive]}>{v}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save profile'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => navigation.goBack()}>
        <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatarPick: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent' },
  avatarPickActive: { borderColor: colors.textPrimary },
  avatarPickImg: { width: '100%', height: '100%' },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 8, padding: spacing.md, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: colors.background, fontWeight: '700' },
  visRow: { marginBottom: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden' },
  segItem: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  segItemActive: { backgroundColor: colors.accent },
  segText: { color: colors.textSecondary, fontSize: 12 },
  segTextActive: { color: colors.background, fontWeight: '700' },
  button: { backgroundColor: colors.accent, borderRadius: 24, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  secondary: { backgroundColor: colors.surface, marginTop: spacing.sm },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
