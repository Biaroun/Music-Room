// mobile/src/screens/PlaylistEditorScreen.tsx
// MOCK : tout est en state local, aucun appel back.
// Quand Biaroun aura les routes, on remplacera les setTracks(...) par des apiFetch.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../config/theme';

type Track = { id: string; title: string; artist: string };

const INITIAL: Track[] = [
  { id: '1', title: 'Blinding Lights', artist: 'The Weeknd' },
  { id: '2', title: 'HUMBLE.', artist: 'Kendrick Lamar' },
  { id: '3', title: 'One More Time', artist: 'Daft Punk' },
];

export default function PlaylistEditorScreen() {
  const [name, setName] = useState('My Playlist');
  const [isPublic, setIsPublic] = useState(true);
  const [tracks, setTracks] = useState<Track[]>(INITIAL);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  function addTrack() {
    if (!title.trim()) return;
    setTracks((t) => [...t, { id: Date.now().toString(), title: title.trim(), artist: artist.trim() || 'Unknown' }]);
    setTitle('');
    setArtist('');
  }

  function removeTrack(id: string) {
    setTracks((t) => t.filter((x) => x.id !== id));
  }

  function move(index: number, dir: -1 | 1) {
    setTracks((t) => {
      const j = index + dir;
      if (j < 0 || j >= t.length) return t;
      const copy = [...t];
      [copy[index], copy[j]] = [copy[j], copy[index]];
      return copy;
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      {/* Spotify-style header */}
      <LinearGradient colors={['#2f6b4f', '#1d3f30', colors.background]} style={styles.header}>
        <LinearGradient
          colors={['#1DB954', '#0b2e22']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        >
          <Text style={styles.coverIcon}>♪</Text>
        </LinearGradient>

        <TextInput
          style={styles.titleInput}
          value={name}
          onChangeText={setName}
          placeholder="Playlist name"
          placeholderTextColor={colors.textSecondary}
        />

        <View style={styles.metaRow}>
          <Text style={styles.meta}>You</Text>
          <Text style={styles.dot}>•</Text>
          <TouchableOpacity onPress={() => setIsPublic((p) => !p)}>
            <Text style={styles.meta}>{isPublic ? 'Public' : 'Private'}</Text>
          </TouchableOpacity>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.meta}>{tracks.length} songs</Text>
        </View>

        <TouchableOpacity style={styles.playFab} activeOpacity={0.85}>
          <Text style={styles.playIcon}>▶</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Track list */}
      <View style={styles.body}>
        {tracks.map((tk, i) => (
          <View key={tk.id} style={styles.row}>
            <Text style={styles.index}>{i + 1}</Text>
            <View style={styles.art}>
              <Text style={styles.artText}>{tk.title[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle} numberOfLines={1}>{tk.title}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>{tk.artist}</Text>
            </View>
            <TouchableOpacity onPress={() => move(i, -1)} style={styles.ctrl}><Text style={styles.ctrlIcon}>▲</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => move(i, 1)} style={styles.ctrl}><Text style={styles.ctrlIcon}>▼</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => removeTrack(tk.id)} style={styles.ctrl}><Text style={[styles.ctrlIcon, { color: '#f87171' }]}>✕</Text></TouchableOpacity>
          </View>
        ))}
        {tracks.length === 0 && <Text style={styles.empty}>No tracks yet. Add the first one below.</Text>}

        {/* Add a track */}
        <Text style={styles.addTitle}>Add a track</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle}
          placeholder="Title" placeholderTextColor={colors.textSecondary} />
        <TextInput style={styles.input} value={artist} onChangeText={setArtist}
          placeholder="Artist" placeholderTextColor={colors.textSecondary} />
        <TouchableOpacity style={styles.addBtn} onPress={addTrack} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>＋  Add track</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const COVER = 160;
const FAB = 56;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingTop: spacing.xl, paddingHorizontal: spacing.md, paddingBottom: spacing.xl + FAB / 2 },
  cover: {
    width: COVER, height: COVER, borderRadius: 6, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  coverIcon: { fontSize: 64, color: colors.textPrimary },
  titleInput: { fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, padding: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dot: { color: colors.textSecondary, fontSize: 13, marginHorizontal: spacing.xs },
  playFab: {
    position: 'absolute', right: spacing.md, bottom: -FAB / 2,
    width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  playIcon: { color: '#000', fontSize: 22, marginLeft: 3 },

  body: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  index: { width: 22, textAlign: 'center', color: colors.textSecondary, fontSize: 14, fontVariant: ['tabular-nums'] },
  art: { width: 44, height: 44, borderRadius: 4, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm, marginRight: spacing.md },
  artText: { color: colors.textSecondary, fontSize: 18, fontWeight: '800' },
  trackInfo: { flex: 1, marginRight: spacing.sm },
  trackTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  trackArtist: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  ctrl: { paddingHorizontal: 6, paddingVertical: spacing.xs },
  ctrlIcon: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  empty: { color: colors.textSecondary, fontSize: 14, paddingVertical: spacing.md },

  addTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.md },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 6, padding: spacing.md, marginBottom: spacing.sm, fontSize: 14 },
  addBtn: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 24, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  addBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
});
