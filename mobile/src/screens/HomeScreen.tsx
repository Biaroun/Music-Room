import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';

type Shortcut = { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; screen?: string; color: string; soon?: boolean };

const SHORTCUTS: Shortcut[] = [
  { title: 'Playlist Editor', icon: 'musical-notes', screen: 'PlaylistEditor', color: '#1DB954' },
  { title: 'My Profile', icon: 'person', screen: 'Profile', color: '#8b5cf6' },
  { title: 'Settings', icon: 'settings', screen: 'Settings', color: '#3b82f6' },
  { title: 'Track Vote', icon: 'bar-chart', screen: 'TrackVote', color: '#e8115b' },
  { title: 'Music Delegation', icon: 'git-network', screen: 'MusicDelegation', color: '#f59e0b' },
  { title: 'Friend', icon: 'people', screen: 'Friends', color: '#1DB954' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Salam Aleykoum';
  return 'Good evening';
}

export default function HomeScreen({ navigation }: any) {
  const { token } = useAuth();
  const [username, setUsername] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      apiFetch('/users/me', token)
        .then((data) => { if (active) setUsername(data.username); })
        .catch(() => {});
      return () => { active = false; };
    }, [token])
  );

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={styles.greeting}>{greeting()}{username ? `, ${username}` : ''}</Text>

      <View style={styles.grid}>
        {SHORTCUTS.map((s) => (
          <TouchableOpacity
            key={s.title}
            style={[styles.card, s.soon && styles.cardDisabled]}
            disabled={s.soon || !s.screen}
            onPress={() => s.screen && navigation.navigate(s.screen)}
            activeOpacity={0.8}
          >
            <View style={[styles.artTile, { backgroundColor: s.color }]}>
              <Ionicons name={s.icon} size={24} color="#fff" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel} numberOfLines={1}>{s.title}</Text>
              {s.soon && <Text style={styles.soon}>Soon</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[typography.h2, ui.section]}>Made for you</Text>
      <TouchableOpacity style={styles.feature} onPress={() => navigation.navigate('PlaylistEditor')} activeOpacity={0.85}>
        <View style={styles.featureArt}><Ionicons name="musical-notes" size={28} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Build your playlist</Text>
          <Text style={styles.featureSub}>Add, reorder and share your tracks</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: spacing.lg },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { flexDirection: 'row', alignItems: 'center', width: '48%', backgroundColor: colors.surface, borderRadius: 6, overflow: 'hidden', marginBottom: spacing.sm },
  cardDisabled: { opacity: 0.5 },
  artTile: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, paddingHorizontal: spacing.sm },
  cardLabel: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  soon: { color: colors.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 2 },

  feature: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md },
  featureArt: { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  featureTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  featureSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
});
