import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { AVATARS } from '../config/avatars';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Field from '../components/Field';
import Button from '../components/Button';
import PressableCard from '../components/PressableCard';

type MusicGenre = 'rap' | 'rnb' | 'rock' | 'pop' | 'jazz' | 'classical' | 'electro' | 'reggae' | 'metal' | 'country';
type Visibility = 'public' | 'friends-only' | 'private';
type VisibilityField = 'username' | 'bio' | 'musicPreferences' | 'listening';

// same genres as the backend enum
const GENRES: MusicGenre[] = ['rap', 'rnb', 'rock', 'pop', 'jazz', 'classical', 'electro', 'reggae', 'metal', 'country'];
const VISIBILITIES: Visibility[] = ['public', 'friends-only', 'private'];
// fields with a visibility setting
const FIELDS: { key: VisibilityField; label: string }[] = [
  { key: 'username', label: 'Username' },
  { key: 'bio', label: 'Bio' },
  { key: 'musicPreferences', label: 'Music preferences' },
  { key: 'listening', label: 'Current listening' },
];
// same max as the backend dto
const BIO_MAX = 255;

// edit my avatar bio genres and visibility
export default function EditProfileScreen({ navigation }: any) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [visibility, setVisibility] = useState<Record<VisibilityField, Visibility>>({
    // l'ecoute en cours n'est de toute facon interrogeable que par les amis
    username: 'public', bio: 'public', musicPreferences: 'public', listening: 'friends-only',
  });
  const [avatar, setAvatar] = useState<string | null>(null);

  // load my current profile to fill the form
  useEffect(() => {
    apiFetch('/users/me', token)
      .then((me) => {
        setBio(me.bio ?? '');
        setGenres(me.musicpreferences ?? []);
        // merge on the defaults (old accounts dont have listening)
        setVisibility((v) => ({ ...v, ...(me.visibilitySettings ?? {}) }));
        setAvatar(me.avatar || null);
      })
      .catch((e: any) => showToast({ type: 'error', message: e.message }))
      .finally(() => setLoading(false));
  }, []);

  // add the genre or remove it if already picked
  function toggleGenre(g: MusicGenre) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  // PATCH the whole profile then go back
  async function save() {
    setSaving(true);
    try {
      await apiFetch('/users/me', token, {
        method: 'PATCH',
        // no avatar = empty string (the backend put null)
        body: JSON.stringify({ bio, musicpreferences: genres, visibilitySettings: visibility, avatar: avatar ?? '' }),
      });
      showToast({ type: 'success', message: 'Profile updated' });
      navigation.goBack();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* avatar picker */}
      <Text style={[typography.h2, styles.firstSection]}>Avatar</Text>
      <View style={styles.avatars}>
        {AVATARS.map((a) => {
          const active = avatar === a.id;
          return (
            <PressableCard
              key={a.id}
              onPress={() => setAvatar(a.id)}
              style={[styles.avatarPick, active && styles.avatarPickActive]}
              hoverStyle={styles.avatarPickHover}
              accessibilityLabel={`Avatar ${a.id}`}
            >
              <Image source={a.source} style={styles.avatarPickImg} />
              {active && (
                <View style={styles.avatarCheck}>
                  <Ionicons name="checkmark" size={12} color={colors.onAccent} />
                </View>
              )}
            </PressableCard>
          );
        })}
      </View>

      {/* bio with the char counter */}
      <Text style={[typography.h2, ui.section]}>Bio</Text>
      <Field
        placeholder="Tell something about you..."
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={BIO_MAX}
        hint={`${bio.length}/${BIO_MAX}`}
      />

      {/* genre chips */}
      <Text style={[typography.h2, ui.section]}>Music preferences</Text>
      <View style={styles.chips}>
        {GENRES.map((g) => {
          const active = genres.includes(g);
          return (
            <PressableCard
              key={g}
              onPress={() => toggleGenre(g)}
              style={[ui.chip, active && styles.chipActive]}
              hoverStyle={active ? styles.chipActiveHover : styles.chipHover}
            >
              <Text style={[ui.chipText, active && styles.chipTextActive]}>{g}</Text>
            </PressableCard>
          );
        })}
      </View>

      {/* one segmented control per field (public friends only private) */}
      <Text style={[typography.h2, ui.section]}>Visibility</Text>
      {FIELDS.map((f) => (
        <View key={f.key} style={styles.visRow}>
          <Text style={[typography.label, { marginBottom: spacing.xs }]}>{f.label}</Text>
          <View style={styles.segment}>
            {VISIBILITIES.map((v) => {
              const active = visibility[f.key] === v;
              return (
                <PressableCard
                  key={v}
                  onPress={() => setVisibility((s) => ({ ...s, [f.key]: v }))}
                  style={[styles.segItem, active && styles.segItemActive]}
                  hoverStyle={active ? undefined : styles.segItemHover}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>{v}</Text>
                </PressableCard>
              );
            })}
          </View>
        </View>
      ))}

      {/* save and cancel */}
      <Button title="Save profile" icon="checkmark" onPress={save} loading={saving} style={{ marginTop: spacing.xl }} />
      <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  firstSection: { marginBottom: spacing.md },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  avatarPick: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarPickHover: { borderColor: colors.borderStrong },
  avatarPickActive: { borderColor: colors.accent },
  avatarPickImg: { width: '100%', height: '100%' },
  avatarCheck: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipHover: { backgroundColor: colors.surfaceHover },
  chipActive: { backgroundColor: colors.accent, borderColor: 'transparent' },
  chipActiveHover: { backgroundColor: colors.accentHover },
  chipTextActive: { color: colors.onAccent, fontWeight: '800' },

  visRow: { marginBottom: spacing.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segItem: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', justifyContent: 'center' },
  segItemHover: { backgroundColor: colors.surface },
  segItemActive: { backgroundColor: colors.accent },
  segText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: colors.onAccent, fontWeight: '800' },
});
