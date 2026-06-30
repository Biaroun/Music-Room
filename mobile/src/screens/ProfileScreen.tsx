// mobile/src/screens/ProfileScreen.tsx (read-only view)
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, spacing } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { getAvatar } from '../config/avatars';

type Visibility = 'public' | 'friends-only' | 'private';
type Me = {
  username: string;
  email: string;
  emailisVerified: boolean;
  bio?: string | null;
  avatar?: string | null;
  musicpreferences?: string[] | null;
  visibilitySettings?: { username?: Visibility; bio?: Visibility; musicPreferences?: Visibility } | null;
};

export default function ProfileScreen({ navigation }: any) {
  const { token } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      apiFetch('/users/me', token)
        .then((data) => { if (active) setMe(data); })
        .catch((e: any) => Alert.alert('Error', e.message))
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [token])
  );

  if (loading)
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;

  const genres = me?.musicpreferences ?? [];
  const vis = me?.visibilitySettings ?? {};
  const av = getAvatar(me?.avatar);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.header}>
        {av ? (
          <Image source={av.source} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{me?.username?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <Text style={typography.h1}>{me?.username}</Text>
        <Text style={typography.caption}>{me?.email}</Text>
        <View style={[styles.badge, { backgroundColor: me?.emailisVerified ? colors.accent : colors.surfaceAlt }]}>
          <Ionicons name={me?.emailisVerified ? 'checkmark-circle' : 'close-circle'} size={12} color={colors.textPrimary} />
          <Text style={styles.badgeText}>{me?.emailisVerified ? ' Email verified' : ' Email not verified'}</Text>
        </View>
      </View>

      <Text style={[typography.h2, styles.section]}>Bio</Text>
      <Text style={[typography.body, !me?.bio && { color: colors.textSecondary }]}>
        {me?.bio || 'No bio yet.'}
      </Text>

      <Text style={[typography.h2, styles.section]}>Music preferences</Text>
      {genres.length ? (
        <View style={styles.chips}>
          {genres.map((g) => (
            <View key={g} style={styles.chip}><Text style={styles.chipText}>{g}</Text></View>
          ))}
        </View>
      ) : (
        <Text style={[typography.body, { color: colors.textSecondary }]}>No preferences yet.</Text>
      )}

      <Text style={[typography.h2, styles.section]}>Visibility</Text>
      <View style={styles.visRow}><Text style={typography.body}>Username</Text><Text style={styles.visValue}>{vis.username ?? 'public'}</Text></View>
      <View style={styles.visRow}><Text style={typography.body}>Bio</Text><Text style={styles.visValue}>{vis.bio ?? 'public'}</Text></View>
      <View style={styles.visRow}><Text style={typography.body}>Music preferences</Text><Text style={styles.visValue}>{vis.musicPreferences ?? 'public'}</Text></View>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('EditProfile')}>
        <Text style={styles.buttonText}>Edit profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  avatarImg: { width: 110, height: 110, borderRadius: 55, marginBottom: spacing.sm },
  avatarText: { color: colors.background, fontSize: 44, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: 12 },
  badgeText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: colors.surface },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  visRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surface },
  visValue: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  button: { backgroundColor: colors.accent, borderRadius: 24, padding: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
