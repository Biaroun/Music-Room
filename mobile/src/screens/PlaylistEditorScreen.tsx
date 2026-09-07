// mobile/src/screens/PlaylistEditorScreen.tsx
// Charge/persiste via le backend playlist-editor (voir mobile/src/lib/playlists.ts).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, layout, radius, shadows, spacing, typography } from '../config/theme';
import { useBottomInset } from '../components/Screen';
import PressableCard from '../components/PressableCard';
import EmptyState from '../components/EmptyState';
import { getTrackBpm } from '../lib/deezer';
import type { DeezerTrack } from '../lib/deezerTypes';
import { usePreviewPlayer, type PreviewTrack } from '../context/PreviewPlayerContext';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../components/Toast';
import TrackSearch from '../components/TrackSearch';
import { apiFetch } from '../config/api';
import {
  type ApiPlaylistTrack,
  type PlaylistCollaborator,
  getPlaylist,
  updatePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  listCollaborators,
  addCollaborator,
  removeCollaborator,
} from '../lib/playlists';

type Track = ApiPlaylistTrack;

// Utilisé seulement quand le websocket ne passe pas, même cadence que RealtimeContext.
const FALLBACK_POLL_MS = 20_000;

function toPreviewTrack(tk: Track): PreviewTrack {
  return {
    id: String(tk.id),
    title: tk.title,
    artist: tk.artist,
    artistId: tk.artistId ?? undefined,
    cover: tk.cover,
    previewUrl: tk.previewUrl,
    bpm: tk.bpm,
  };
}

export default function PlaylistEditorScreen({ route }: any) {
  const playlistId: number = route.params.playlistId;
  const { token } = useAuth();
  const { showToast } = useToast();
  const { activeTrack, isPlaying, toggle } = usePreviewPlayer();
  const bottomInset = useBottomInset();
  const {
    connected, playlistState, joinPlaylist, leavePlaylist,
    addTrackRealtime, removeTrackRealtime, reorderRealtime,
  } = useRealtime();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tracks, setTracks] = useState<Track[]>([]);
  // version du dernier état vu : renvoyée à chaque reorder pour que le serveur
  // refuse le nôtre si quelqu'un a réordonné entre-temps
  const [version, setVersion] = useState(0);
  const [isOwner, setIsOwner] = useState(true);
  const [collaborators, setCollaborators] = useState<PlaylistCollaborator[]>([]);
  const [friends, setFriends] = useState<{ friendId: number; username: string }[]>([]);

  useEffect(() => {
    joinPlaylist(playlistId);
    return () => leavePlaylist(playlistId);
  }, [playlistId, joinPlaylist, leavePlaylist]);

  // Le socket est la source temps réel ; ce chargement REST couvre le premier
  // affichage et le cas où le websocket ne passe pas. C'est aussi lui qui donne
  // isOwner, AuthContext n'exposant pas l'utilisateur courant.
  const loadFromRest = useCallback(() => {
    return getPlaylist(playlistId, token)
      .then(async (playlist) => {
        setName(playlist.name);
        setIsPublic(playlist.isPublic);
        setTracks(playlist.tracks ?? []);
        setVersion(playlist.version);
        setIsOwner(playlist.isOwner ?? true);
        setCollaborators(await listCollaborators(playlistId, token).catch(() => []));
      })
      .catch(() => showToast({ type: 'error', message: 'Failed to load playlist' }));
  }, [playlistId, token]);

  useEffect(() => {
    loadFromRest().finally(() => setLoading(false));
  }, [loadFromRest]);

  // Repli : tant que le websocket ne passe pas, on interroge le REST.
  useEffect(() => {
    if (connected) return;
    const id = setInterval(loadFromRest, FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [connected, loadFromRest]);

  // Un état poussé par le serveur fait toujours autorité sur l'état local.
  useEffect(() => {
    if (!playlistState || playlistState.id !== playlistId) return;
    setName(playlistState.name);
    setIsPublic(playlistState.isPublic);
    setTracks(playlistState.tracks);
    setVersion(playlistState.version);
    setCollaborators(playlistState.collaborators);
  }, [playlistState, playlistId]);

  useEffect(() => {
    if (!isOwner) return;
    apiFetch('/friendship/friends', token)
      .then(setFriends)
      .catch(() => {});
  }, [isOwner, token]);

  function saveName() {
    if (!name.trim()) return;
    updatePlaylist(playlistId, token, { name: name.trim() }).catch(() =>
      showToast({ type: 'error', message: 'Failed to save name' })
    );
  }

  function toggleVisibility() {
    const next = !isPublic;
    setIsPublic(next);
    updatePlaylist(playlistId, token, { isPublic: next }).catch(() => {
      setIsPublic(!next);
      showToast({ type: 'error', message: 'Failed to update visibility' });
    });
  }

  // Deezer ne donne le bpm que via /track/{id}, pas dans les resultats de recherche —
  // on le recupere avant l'ajout, comme ca le backend a directement la bonne valeur.
  async function pickTrack(dt: DeezerTrack) {
    const bpm = dt.bpm ?? (await getTrackBpm(dt.id).catch(() => null));
    const dto = {
      deezerId: dt.id,
      title: dt.title,
      artist: dt.artist,
      artistId: dt.artistId || undefined,
      cover: dt.cover ?? undefined,
      previewUrl: dt.previewUrl!,
      bpm: bpm ?? undefined,
    };
    if (connected) {
      // l'état revient par playlist:state, inutile de toucher tracks ici
      addTrackRealtime(playlistId, dto);
      return;
    }
    try {
      const track = await addTrackToPlaylist(playlistId, token, dto);
      setTracks((t) => [...t, track]);
    } catch {
      showToast({ type: 'error', message: 'Failed to add track' });
    }
  }

  async function removeTrack(trackId: number) {
    if (connected) {
      removeTrackRealtime(playlistId, trackId);
      return;
    }
    try {
      await removeTrackFromPlaylist(playlistId, trackId, token);
      setTracks((t) => t.filter((x) => x.id !== trackId));
    } catch {
      showToast({ type: 'error', message: 'Failed to remove track' });
    }
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= tracks.length) return;
    const copy = [...tracks];
    [copy[index], copy[j]] = [copy[j], copy[index]];
    // optimiste : le broadcast (ou playlist:conflict) réconcilie juste après
    setTracks(copy);

    const ids = copy.map((tk) => tk.id);
    if (connected) {
      reorderRealtime(playlistId, ids, version);
      return;
    }
    // Repli REST : apiFetch ne remonte pas le statut HTTP, on ne peut pas
    // distinguer un 409 d'une autre erreur — on recharge l'ordre du serveur.
    reorderPlaylistTracks(playlistId, token, ids, version)
      .then((state) => setVersion(state.version))
      .catch(() => {
        showToast({ type: 'error', message: 'Failed to save order' });
        loadFromRest();
      });
  }

  async function toggleCollaborator(friendId: number, isCollaborator: boolean) {
    try {
      if (isCollaborator) await removeCollaborator(playlistId, token, friendId);
      else await addCollaborator(playlistId, token, friendId);
      setCollaborators(await listCollaborators(playlistId, token));
    } catch {
      showToast({ type: 'error', message: 'Failed to update editors' });
    }
  }

  function playAll() {
    if (tracks.length === 0) return;
    const queue = tracks.map(toPreviewTrack);
    toggle(queue[0], queue);
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const wholePlaylistPlaying = tracks.length > 0 && activeTrack?.id === String(tracks[0].id) && isPlaying;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottomInset + spacing.xl }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* En-tête façon Spotify : dégradé pleine largeur, contenu borné comme le reste de l'app */}
      <LinearGradient colors={['#2f6b4f', '#1d3f30', colors.background]} style={styles.header}>
        <View style={styles.column}>
          <LinearGradient
            colors={['#1DB954', '#0b2e22']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}
          >
            <Ionicons name="musical-note" size={64} color={colors.textPrimary} />
          </LinearGradient>

          {isOwner ? (
            <TextInput
              style={styles.titleInput}
              value={name}
              onChangeText={setName}
              onBlur={saveName}
              placeholder="Playlist name"
              placeholderTextColor={colors.textSecondary}
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.titleInput} numberOfLines={2}>{name}</Text>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.meta}>{isOwner ? 'You' : playlistState?.owner.username ?? 'Shared with you'}</Text>
            <Text style={styles.dot}>•</Text>
            {isOwner ? (
              <PressableCard
                onPress={toggleVisibility}
                style={styles.visToggle}
                hoverStyle={styles.visToggleHover}
                accessibilityLabel="Toggle playlist visibility"
              >
                <Ionicons name={isPublic ? 'earth' : 'lock-closed'} size={12} color={colors.textSecondary} />
                <Text style={styles.meta}>{isPublic ? 'Public' : 'Private'}</Text>
              </PressableCard>
            ) : (
              <View style={styles.visToggle}>
                <Ionicons name={isPublic ? 'earth' : 'lock-closed'} size={12} color={colors.textSecondary} />
                <Text style={styles.meta}>{isPublic ? 'Public' : 'Private'}</Text>
              </View>
            )}
            <Text style={styles.dot}>•</Text>
            <Text style={styles.meta}>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</Text>
            {!connected && (
              <>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.meta}>Offline</Text>
              </>
            )}
          </View>

          <PressableCard
            style={[styles.playFab, tracks.length === 0 && styles.playFabOff]}
            hoverStyle={styles.playFabHover}
            onPress={playAll}
            disabled={tracks.length === 0}
            accessibilityLabel="Play playlist"
          >
            <Ionicons name={wholePlaylistPlaying ? 'pause' : 'play'} size={22} color={colors.onAccent} />
          </PressableCard>
        </View>
      </LinearGradient>

      {/* Track list */}
      <View style={[styles.column, styles.body]}>
        {tracks.map((tk, i) => {
          const isCurrent = activeTrack?.id === String(tk.id);
          return (
            <PressableCard
              key={tk.id}
              style={[styles.row, isCurrent && styles.rowActive]}
              hoverStyle={styles.rowHover}
              onPress={() => toggle(toPreviewTrack(tk))}
            >
              <Text style={[styles.index, isCurrent && { color: colors.accent }]}>{i + 1}</Text>
              <View style={styles.art}>
                {tk.cover ? (
                  <Image source={{ uri: tk.cover }} style={styles.artImg} />
                ) : (
                  <Text style={styles.artText}>{tk.title[0]?.toUpperCase() ?? '?'}</Text>
                )}
              </View>
              <View style={styles.trackInfo}>
                <Text style={[styles.trackTitle, isCurrent && { color: colors.accent }]} numberOfLines={1}>{tk.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{tk.artist}</Text>
              </View>
              <Pressable onPress={() => toggle(toPreviewTrack(tk))} hitSlop={6} style={styles.ctrl} accessibilityLabel="Play track">
                <Ionicons name={isCurrent && isPlaying ? 'pause' : 'play'} size={16} color={colors.accent} />
              </Pressable>
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} style={styles.ctrl} accessibilityLabel="Move up">
                <Ionicons name="chevron-up" size={16} color={i === 0 ? colors.textTertiary : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => move(i, 1)} disabled={i === tracks.length - 1} hitSlop={6} style={styles.ctrl} accessibilityLabel="Move down">
                <Ionicons name="chevron-down" size={16} color={i === tracks.length - 1 ? colors.textTertiary : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => removeTrack(tk.id)} hitSlop={6} style={styles.ctrl} accessibilityLabel="Remove track">
                <Ionicons name="close" size={16} color={colors.danger} />
              </Pressable>
            </PressableCard>
          );
        })}

        {tracks.length === 0 && (
          <EmptyState
            icon="disc-outline"
            title="No tracks yet"
            message="Search Deezer below to add the first track to this playlist."
          />
        )}

        {/* Add a track */}
        <Text style={styles.addTitle}>Add a track</Text>
        <TrackSearch onSelect={pickTrack} />

        {/* Editors : seul le proprietaire donne ou retire le droit d'edition */}
        <Text style={styles.addTitle}>Editors</Text>
        {isOwner ? (
          friends.length === 0 ? (
            <Text style={styles.trackArtist}>Add friends to invite them as editors.</Text>
          ) : (
            friends.map((f) => {
              const isCollaborator = collaborators.some((c) => c.id === f.friendId);
              return (
                <PressableCard
                  key={f.friendId}
                  style={styles.row}
                  hoverStyle={styles.rowHover}
                  onPress={() => toggleCollaborator(f.friendId, isCollaborator)}
                  accessibilityLabel={isCollaborator ? `Remove ${f.username} as editor` : `Add ${f.username} as editor`}
                >
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle}>{f.username}</Text>
                  </View>
                  <Ionicons
                    name={isCollaborator ? 'checkmark-circle' : 'add-circle-outline'}
                    size={20}
                    color={isCollaborator ? colors.accent : colors.textSecondary}
                  />
                </PressableCard>
              );
            })
          )
        ) : (
          <Text style={styles.trackArtist}>
            {collaborators.length > 0
              ? collaborators.map((c) => c.username).join(', ')
              : 'No other editors.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const COVER = 160;
const FAB = 56;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },

  header: { paddingTop: spacing.xl, paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  cover: {
    width: COVER, height: COVER, borderRadius: radius.md, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
    ...shadows.floating,
  },
  titleInput: {
    fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.8,
    padding: 0, outlineWidth: 0,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dot: { color: colors.textSecondary, fontSize: 13, marginHorizontal: spacing.xs },
  visToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: 3, paddingHorizontal: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  visToggleHover: { backgroundColor: 'rgba(255,255,255,0.08)' },
  playFab: {
    position: 'absolute', right: 0, bottom: -(FAB / 2 + spacing.xl),
    width: FAB, height: FAB, borderRadius: FAB / 2, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.floating,
  },
  playFabHover: { backgroundColor: colors.accentHover },
  playFabOff: { opacity: 0.45 },

  // paddingTop laisse passer la moitié du bouton play qui déborde de l'en-tête
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.xl + spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowHover: { backgroundColor: colors.surfaceAlt },
  rowActive: { backgroundColor: colors.accentSoft },
  index: { width: 22, textAlign: 'center', color: colors.textSecondary, fontSize: 14, fontVariant: ['tabular-nums'] },
  art: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm, marginRight: spacing.md, overflow: 'hidden' },
  artImg: { width: '100%', height: '100%' },
  artText: { color: colors.textSecondary, fontSize: 18, fontWeight: '800' },
  trackInfo: { flex: 1, marginRight: spacing.sm },
  trackTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  trackArtist: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  ctrl: { paddingHorizontal: 6, paddingVertical: spacing.xs, cursor: 'pointer' },

  addTitle: { ...typography.h2, marginTop: spacing.xl, marginBottom: spacing.md },
});
