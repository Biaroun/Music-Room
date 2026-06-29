import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';

type Shortcut = { title: string; emoji: string; screen?: string; color: string; soon?: boolean };

const SHORTCUTS: Shortcut[] = [
  { title: 'Playlist Editor', emoji: '🎵', screen: 'PlaylistEditor', color: '#1DB954' },
  { title: 'My Profile', emoji: '👤', screen: 'Profile', color: '#8b5cf6' },
  { title: 'Settings', emoji: '⚙️', screen: 'Settings', color: '#3b82f6' },
  { title: 'Track Vote', emoji: '🗳️', color: '#e8115b', soon: true },
  { title: 'Friend', emoji: '👥', screen: 'Friends', color: '#1DB954' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Salam Aleykoum';
  return 'Good evening';
}

export default function HomeScreen({ navigation }: any) {
  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={styles.greeting}>{greeting()}</Text>

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
              <Text style={styles.artEmoji}>{s.emoji}</Text>
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
        <View style={styles.featureArt}><Text style={styles.featureEmoji}>🎶</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Build your playlist</Text>
          <Text style={styles.featureSub}>Add, reorder and share your tracks</Text>
        </View>
        <Text style={styles.featureChevron}>›</Text>
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
  artEmoji: { fontSize: 24 },
  cardText: { flex: 1, paddingHorizontal: spacing.sm },
  cardLabel: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  soon: { color: colors.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 2 },

  feature: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md },
  featureArt: { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  featureEmoji: { fontSize: 28 },
  featureTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  featureSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  featureChevron: { color: colors.textSecondary, fontSize: 28, marginLeft: spacing.sm },
});
