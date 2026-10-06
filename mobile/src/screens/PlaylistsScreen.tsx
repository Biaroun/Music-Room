import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, layout, radius, spacing, shadows, typography } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Screen, { useBottomInset } from '../components/Screen';
import PressableCard from '../components/PressableCard';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { type ApiPlaylist, listMyPlaylists, createPlaylist, deletePlaylist } from '../lib/playlists';

export default function PlaylistsScreen({ navigation }: any) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const bottomInset = useBottomInset();
  const { width } = useWindowDimensions();
  // 2 colonnes des qu'on a la place (web / tablette), 1 sur telephone
  const columns = width >= layout.wideBreakpoint ? 2 : 1;
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // reload the list each time we come back on the screen
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

  // create an empty playlist and open the editor right away
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

  // delete a playlist and remove it from the list
  async function handleDelete(id: number) {
    try {
      await deletePlaylist(id, token);
      setPlaylists((p) => p.filter((pl) => pl.id !== id));
      showToast({ type: 'success', message: 'Playlist deleted' });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete playlist' });
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
    <Screen scroll={false} padded={false} wide>
      <FlatList
        // key = columns so the FlatList remount when the columns change (numColumns cant change live)
        key={columns}
        data={playlists}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        keyExtractor={(p) => String(p.id)}
        // +88 so the last row is not under the floating button
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 88 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          playlists.length > 0 ? (
            <Text style={[typography.label, styles.count]}>
              {playlists.length} {playlists.length > 1 ? 'playlists' : 'playlist'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="musical-notes-outline"
            title="No playlists yet"
            message="Create your first playlist and start adding tracks from Deezer."
            actionLabel="New Playlist"
            onAction={handleCreate}
          />
        }
        // one row per playlist (icon name visibility count shared badge delete)
        renderItem={({ item }) => (
          <PressableCard
            style={[styles.row, columns > 1 && styles.rowGrid]}
            onPress={() => navigation.navigate('PlaylistEditor', { playlistId: item.id })}
            accessibilityLabel={item.name}
          >
            <View style={styles.art}>
              <Ionicons name="musical-notes" size={20} color={colors.accent} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons
                  name={item.isPublic ? 'earth' : 'lock-closed'}
                  size={11}
                  color={colors.textSecondary}
                />
                <Text style={styles.meta}>
                  {item.isPublic ? 'Public' : 'Private'} · {item.tracks?.length ?? 0} songs
                </Text>
                {item.isOwner === false && (
                  <View style={styles.sharedBadge}>
                    <Ionicons name="person" size={11} color={colors.textSecondary} />
                    <Text style={styles.meta} numberOfLines={1}>{item.owner.username}</Text>
                  </View>
                )}
              </View>
            </View>
            {/* Seul le proprietaire peut supprimer : un collaborateur n'edite que le contenu */}
            {item.isOwner !== false && (
              <Pressable
                onPress={() => handleDelete(item.id)}
                hitSlop={8}
                accessibilityLabel={`Delete ${item.name}`}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }, { cursor: 'pointer' }]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            )}
          </PressableCard>
        )}
      />

      {/* floating new playlist button (the empty state has its own button) */}
      {playlists.length > 0 && (
        <View style={[styles.fabWrap, { bottom: bottomInset + spacing.md }]}>
          <Button
            title="New Playlist"
            icon="add"
            onPress={handleCreate}
            loading={creating}
            style={[styles.fab, shadows.floating]}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, width: '100%', alignSelf: 'center' },
  count: { marginBottom: spacing.sm, marginLeft: 2 },
  // colonnes du haut alignees, meme largeur : cf. Screen wide sur cet ecran
  gridRow: { gap: spacing.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  rowGrid: { flex: 1 },
  art: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 },
  meta: { color: colors.textSecondary, fontSize: 12 },
  sharedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 1, paddingHorizontal: spacing.xs,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  deleteBtn: { padding: spacing.xs },

  // box-none : la zone autour du bouton laisse passer les clics vers la liste dessous
  fabWrap: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', pointerEvents: 'box-none' },
  fab: { width: '100%', maxWidth: 320 },
});
