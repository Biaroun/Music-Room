// mobile/src/screens/ProfileScreen.tsx (read-only view)
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { getAvatar } from '../config/avatars';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Button from '../components/Button';

type Visibility = 'public' | 'friends-only' | 'private';
// my profile as GET users me send it
type Me = {
  username: string;
  email: string;
  emailisVerified: boolean;
  bio?: string | null;
  avatar?: string | null;
  musicpreferences?: string[] | null;
  visibilitySettings?: { username?: Visibility; bio?: Visibility; musicPreferences?: Visibility; listening?: Visibility } | null;
};

// icon per visibility value
const VIS_ICON: Record<Visibility, React.ComponentProps<typeof Ionicons>['name']> = {
  public: 'earth',
  'friends-only': 'people',
  private: 'lock-closed',
};

// read only view of my profile
export default function ProfileScreen({ navigation }: any) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // reload the profile each time we come back (after edit)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      apiFetch('/users/me', token)
        .then((data) => {
          if (!active) return;
          setMe(data);
        })
        .catch((e: any) => showToast({ type: 'error', message: e.message }))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [token])
  );

  if (loading) {
    return (
      <Screen scroll={false} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const genres = me?.musicpreferences ?? [];
  const vis = me?.visibilitySettings ?? {};
  const av = getAvatar(me?.avatar ?? null);
  const verified = !!me?.emailisVerified;

  // rows of the visibility card (same defaults as the backend)
  const visRows: { label: string; value: Visibility }[] = [
    { label: 'Username', value: vis.username ?? 'public' },
    { label: 'Bio', value: vis.bio ?? 'public' },
    { label: 'Music preferences', value: vis.musicPreferences ?? 'public' },
    { label: 'Current listening', value: vis.listening ?? 'friends-only' },
  ];

  return (
    <Screen>
      {/* avatar (or first letter) name email verified badge */}
      <View style={styles.header}>
        {av ? (
          <Image source={av.source} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{me?.username?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <Text style={[typography.h1, { marginTop: spacing.md }]}>{me?.username}</Text>
        <Text style={[typography.caption, { marginTop: 2 }]}>{me?.email}</Text>
        <View style={[ui.badge, { backgroundColor: verified ? colors.accentSoft : colors.surface, marginTop: spacing.sm }]}>
          <Ionicons
            name={verified ? 'checkmark-circle' : 'alert-circle'}
            size={13}
            color={verified ? colors.accent : colors.warning}
          />
          <Text style={[ui.badgeText, { color: verified ? colors.accent : colors.warning }]}>
            {verified ? 'Email verified' : 'Email not verified'}
          </Text>
        </View>
      </View>

      {/* bio card */}
      <Text style={[typography.h2, ui.section]}>Bio</Text>
      <View style={ui.card}>
        <Text style={[typography.body, styles.bio, !me?.bio && { color: colors.textSecondary, fontStyle: 'italic' }]}>
          {me?.bio || 'No bio yet.'}
        </Text>
      </View>

      {/* genres chips or empty card */}
      <Text style={[typography.h2, ui.section]}>Music preferences</Text>
      {genres.length ? (
        <View style={styles.chips}>
          {genres.map((g) => (
            <View key={g} style={[ui.chip, styles.chipOn]}>
              <Text style={[ui.chipText, { color: colors.accent }]}>{g}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={ui.card}>
          <Text style={[typography.body, { color: colors.textSecondary, fontStyle: 'italic' }]}>No preferences yet.</Text>
        </View>
      )}

      {/* visibility of each field */}
      <Text style={[typography.h2, ui.section]}>Visibility</Text>
      <View style={styles.visCard}>
        {visRows.map((r, i) => (
          <View key={r.label} style={[styles.visRow, i > 0 && styles.visRowBorder]}>
            <Text style={typography.body}>{r.label}</Text>
            <View style={styles.visValue}>
              <Ionicons name={VIS_ICON[r.value]} size={13} color={colors.textSecondary} />
              <Text style={styles.visValueText}>{r.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Button
        title="Edit profile"
        icon="create-outline"
        onPress={() => navigation.navigate('EditProfile')}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: spacing.md },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 104, height: 104, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border },
  avatarText: { color: colors.onAccent, fontSize: 40, fontWeight: '800' },

  bio: { lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: 'transparent' },

  visCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  visRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2 },
  visRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  visValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  visValueText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
