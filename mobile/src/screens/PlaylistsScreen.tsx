import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { type ApiPlaylist, listMyPlaylists, createPlaylist, deletePlaylist } from '../lib/playlists';

export default function PlaylistsScreen({ navigation }: any) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listMyPlaylists(token)
        .then((data) => { if (active) setPlaylists(data); })
        .catch(() => { if (active) showToast({ type: 'error', message: 'Failed to load playlists' }); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [token])
  );

  async function handleCreate() {
    setCreating(true);
    try {
      const playlist = await createPlaylist(token, { name: 'New Playlist', isPublic: true });
      navigation.navigate('PlaylistEditor', { playlistId: playlist.id });
    } catch {
      showToast({ type: 'error', message: 'Failed to create playlist' });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deletePlaylist(id, token);
      setPlaylists((p) => p.filter((pl) => pl.id !== id));
    } catch {
      showToast({ type: 'error', message: 'Failed to delete playlist' });
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={playlists}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
        ListEmptyComponent={<Text style={styles.empty}>No playlists yet. Create your first one below.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('PlaylistEditor', { playlistId: item.id })}
            activeOpacity={0.7}
          >
            <View style={styles.art}>
              <Ionicons name="musical-notes" size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.meta}>{item.isPublic ? 'Public' : 'Private'} · {item.tracks?.length ?? 0} songs</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating} activeOpacity={0.85}>
        {creating ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.createText}>New Playlist</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  empty: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: spacing.xl },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm },
  art: { width: 44, height: 44, borderRadius: 4, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  info: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: spacing.xs },

  createBtn: {
    position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: 24, paddingVertical: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  createText: { color: '#000', fontWeight: '800', fontSize: 14, marginLeft: spacing.xs },
});
