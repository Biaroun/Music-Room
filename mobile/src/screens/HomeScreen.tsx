import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, layout, radius, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import type { ApiPlaylist } from '../lib/playlists';
import TrackSearch from '../components/TrackSearch';
import Screen from '../components/Screen';
import PressableCard from '../components/PressableCard';

type Shortcut = {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  screen: string;
  color: string;
};

const SHORTCUTS: Shortcut[] = [
  { title: 'Playlists', subtitle: 'Your mixes', icon: 'musical-notes', screen: 'Playlists', color: '#1DB954' },
  { title: 'Friends', subtitle: 'Your circle', icon: 'people', screen: 'Friends', color: '#22d3ee' },
  { title: 'My Profile', subtitle: 'Bio & tastes', icon: 'person', screen: 'Profile', color: '#8b5cf6' },
  { title: 'Track Vote', subtitle: 'Pick the next', icon: 'bar-chart', screen: 'Events', color: '#e8115b' },
  // le back n'existe pas encore : on le dit ici plutot que de le laisser
  // decouvrir apres le clic
  { title: 'Delegation', subtitle: 'Not yet available', icon: 'git-network', screen: 'MusicDelegation', color: '#f59e0b' },
  { title: 'Settings', subtitle: 'Your account', icon: 'settings', screen: 'Settings', color: '#3b82f6' },
];

// la couleur sert de teinte de fond, pas d'aplat : 6 carres satures
// ecrasent le reste de la page
function tint(hex: string) {
  return `${hex}24`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Salam Aleykoum';
  return 'Good evening';
}

export default function HomeScreen({ navigation }: any) {
  const { token } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [latest, setLatest] = useState<ApiPlaylist | null>(null);
  const [loadedPlaylists, setLoadedPlaylists] = useState(false);
  const { width } = useWindowDimensions();
  // 3 colonnes des qu'on a la place (web / tablette), 2 sur telephone
  const columns = width >= layout.wideBreakpoint ? 3 : 2;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      apiFetch('/users/me', token)
        .then((data) => { if (active) setUsername(data.username); })
        .catch(() => {});
      // findMine renvoie les playlists possedees d'abord, plus recentes en tete
      apiFetch('/playlist-editor', token)
        .then((list: ApiPlaylist[]) => {
          if (!active) return;
          setLatest(Array.isArray(list) && list.length ? list[0] : null);
          setLoadedPlaylists(true);
        })
        .catch(() => { if (active) setLoadedPlaylists(true); });
      return () => { active = false; };
    }, [token])
  );

  const trackCount = latest?.tracks?.length ?? 0;

  return (
    <Screen>
      <Text style={styles.greeting}>{greeting()}{username ? `, ${username}` : ''}</Text>
      <Text style={styles.greetingSub}>What are we listening to today?</Text>

      <TrackSearch placeholder="Search music…" />

      <Text style={[typography.h2, ui.section]}>Quick access</Text>
      <View style={styles.grid}>
        {SHORTCUTS.map((s) => (
          <PressableCard
            key={s.title}
            style={[styles.card, { flexBasis: columns === 3 ? '31%' : '47%' }]}
            onPress={() => navigation.navigate(s.screen)}
            accessibilityLabel={s.title}
          >
            <View style={[styles.artTile, { backgroundColor: tint(s.color) }]}>
              <Ionicons name={s.icon} size={20} color={s.color} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel} numberOfLines={1}>{s.title}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{s.subtitle}</Text>
            </View>
          </PressableCard>
        ))}
      </View>

      {loadedPlaylists && (
        <>
          <Text style={[typography.h2, ui.section]}>{latest ? 'Pick up where you left off' : 'Start here'}</Text>
          <PressableCard
            style={styles.feature}
            onPress={() =>
              latest
                ? navigation.navigate('PlaylistEditor', { playlistId: latest.id })
                : navigation.navigate('Playlists')
            }
            accessibilityLabel={latest ? `Open ${latest.name}` : 'Create your first playlist'}
          >
            <View style={styles.featureArt}>
              {latest && trackCount > 0 ? (
                // le compteur porte l'information, une note generique n'aurait rien dit
                <Text style={styles.featureCount}>{trackCount}</Text>
              ) : (
                <Ionicons name={latest ? 'musical-notes' : 'add'} size={24} color={colors.accent} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle} numberOfLines={1}>
                {latest ? latest.name : 'Create your first playlist'}
              </Text>
              <Text style={styles.featureSub} numberOfLines={1}>
                {latest
                  ? `${trackCount === 0 ? 'No tracks yet' : `${trackCount} ${trackCount > 1 ? 'tracks' : 'track'}`}${latest.isOwner === false ? `, shared by ${latest.owner.username}` : ''}`
                  : 'Search Deezer and add your first tracks'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </PressableCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.h1, fontSize: 30 },
  greetingSub: { ...typography.caption, marginTop: spacing.xs, marginBottom: spacing.lg },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  artTile: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardLabel: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  cardSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },

  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  featureArt: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCount: { color: colors.accent, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  featureTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  featureSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
});
