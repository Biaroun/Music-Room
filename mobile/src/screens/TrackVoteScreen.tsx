import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, Pressable, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, layout, radius, shadows, spacing, typography } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useRealtime, type VoteBoardTrack, type VoteNowPlaying } from '../context/RealtimeContext';
import { usePreviewPlayer, type PreviewTrack } from '../context/PreviewPlayerContext';
import { useToast } from '../components/Toast';
import Screen, { useBottomInset } from '../components/Screen';
import PressableCard from '../components/PressableCard';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import TrackSearch from '../components/TrackSearch';
import EventSettingsModal from './EventSettingsModal';
import type { DeezerTrack } from '../lib/deezerTypes';
import {
  getBoard,
  suggestTrack,
  importPlaylist,
  castVote,
  retractVote,
  getEvent,
  type ApiEvent,
  type Board,
} from '../lib/trackVote';
import { listMyPlaylists, type ApiPlaylist } from '../lib/playlists';

// event now playing to a player track
function nowPlayingToPreviewTrack(np: VoteNowPlaying): PreviewTrack {
  return { id: String(np.trackId), title: np.title, artist: np.artist, cover: np.cover, previewUrl: np.previewUrl };
}

// repli rest tant que le websocket ne passe pas (meme seuil que RealtimeContext).
const FALLBACK_POLL_MS = 20_000;

// vote screen of an event (board now playing suggest import settings for the owner)
export default function TrackVoteScreen({ route, navigation }: any) {
  const eventId: number = route.params.eventId;
  const { token } = useAuth();
  const { showToast } = useToast();
  const bottomInset = useBottomInset();
  const { connected, voteBoard, joinEvent, leaveEvent, castVoteRealtime, retractVoteRealtime } = useRealtime();

  const [event, setEvent] = useState<ApiEvent | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  // trackId being voted right now (spinner on that row)
  const [voting, setVoting] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<ApiPlaylist[]>([]);
  const [importing, setImporting] = useState(false);
  // permission refused once = on redemande pas at each vote
  const locationDeniedRef = useRef(false);

  // lecture partagee : une fois qu'on a rejoint, chaque changement de morceau
  // "en cours" est relance automatiquement via le lecteur global de l'app
  // (meme lecteur que TrackSearch/PlaylistEditor, visible dans le MiniPlayer).
  const [listeningAlong, setListeningAlong] = useState(false);
  const { activeTrack, isPlaying, toggle: togglePlayback } = usePreviewPlayer();
  // last now playing track we started (so we dont restart the same one)
  const lastAutoPlayedIdRef = useRef<number | null>(null);

  useEffect(() => {
    // settings gear in the header only for the owner
    navigation.setOptions({
      headerRight: event?.isOwner
        ? () => (
            <Pressable onPress={() => setSettingsVisible(true)} hitSlop={10} style={{ paddingHorizontal: spacing.sm }}>
              <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, event?.isOwner]);

  // on focus load event + board and join the room (leave the room on blur)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getEvent(eventId, token)
        .then((e) => { if (active) setEvent(e); })
        .catch(() => { if (active) showToast({ type: 'error', message: 'Failed to load event' }); });

      getBoard(eventId, token)
        .then((b) => { if (active) setBoard(b); })
        .catch(() => { if (active) showToast({ type: 'error', message: 'Failed to load board' }); })
        .finally(() => { if (active) setLoading(false); });

      joinEvent(eventId);
      return () => {
        active = false;
        leaveEvent(eventId);
      };
    }, [eventId, token]),
  );

  // le board temps reel remplace le board rest des qu'il arrive.
  useEffect(() => {
    if (voteBoard) setBoard(voteBoard);
  }, [voteBoard]);

  // repli : tant que le socket ne passe pas, on interroge le REST.
  useEffect(() => {
    if (connected) return;
    const id = setInterval(() => {
      getBoard(eventId, token).then(setBoard).catch(() => {});
    }, FALLBACK_POLL_MS);
    return () => clearInterval(id);
  }, [connected, eventId, token]);

  // des qu'on a rejoint l'ecoute, chaque nouveau morceau "en cours" (vote qui
  // change le classement, ou fin naturelle du morceau precedent) relance la
  // lecture automatiquement.
  useEffect(() => {
    if (!listeningAlong || !board?.nowPlaying) return;
    if (lastAutoPlayedIdRef.current === board.nowPlaying.trackId) return;
    lastAutoPlayedIdRef.current = board.nowPlaying.trackId;
    togglePlayback(nowPlayingToPreviewTrack(board.nowPlaying));
  }, [listeningAlong, board?.nowPlaying?.trackId]);

  // le premier appui est le "geste utilisateur" requis par les navigateurs
  // pour autoriser la lecture audio ; les changements suivants heritent de
  // cette autorisation tant que la page reste ouverte.
  function joinListening() {
    setListeningAlong(true);
    if (board?.nowPlaying) {
      lastAutoPlayedIdRef.current = board.nowPlaying.trackId;
      togglePlayback(nowPlayingToPreviewTrack(board.nowPlaying));
    }
  }

  // gps position only for geo time events (undefined if denied or error)
  async function resolvePosition(): Promise<{ latitude: number; longitude: number } | undefined> {
    if (event?.licenseMode !== 'geo-time-restricted') return undefined;
    if (locationDeniedRef.current) return undefined;

    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        locationDeniedRef.current = true;
        showToast({ type: 'error', message: 'Location permission is required to vote in this event' });
        return undefined;
      }
      const pos = await Location.getCurrentPositionAsync({});
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      showToast({ type: 'error', message: 'Could not get your location' });
      return undefined;
    }
  }

  // on peut voter pour plusieurs morceaux differents, mais une seule fois
  // chacun : appuyer sur un morceau deja vote retire le vote (toggle).
  async function toggleVote(track: VoteBoardTrack) {
    setVoting(track.trackId);
    try {
      const position = await resolvePosition();
      // geo event without position = the vote would fail anyway
      if (event?.licenseMode === 'geo-time-restricted' && !position) return;

      if (connected) {
        if (track.myVote) retractVoteRealtime(eventId, track.trackId, position);
        else castVoteRealtime(eventId, track.trackId, position);
      } else {
        const updated = track.myVote
          ? await retractVote(eventId, track.trackId, token, position)
          : await castVote(eventId, track.trackId, token, position);
        setBoard(updated);
      }
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to vote' });
    } finally {
      setVoting(null);
    }
  }

  // suggest a deezer track then reload the board
  async function suggest(track: DeezerTrack) {
    try {
      await suggestTrack(eventId, token, {
        deezerId: track.id,
        title: track.title,
        artist: track.artist,
        artistId: track.artistId || undefined,
        cover: track.cover ?? undefined,
        previewUrl: track.previewUrl!,
        bpm: track.bpm ?? undefined,
      });
      const updated = await getBoard(eventId, token);
      setBoard(updated);
      showToast({ type: 'success', message: 'Track suggested' });
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to suggest track' });
    }
  }

  // load my playlists and open the import picker
  async function openPlaylistPicker() {
    try {
      const playlists = await listMyPlaylists(token);
      if (playlists.length === 0) {
        showToast({ type: 'error', message: 'You have no playlists to import from' });
        return;
      }
      setMyPlaylists(playlists);
      setPlaylistPickerVisible(true);
    } catch {
      showToast({ type: 'error', message: 'Failed to load your playlists' });
    }
  }

  // import a playlist in the event then reload the board
  async function importFromPlaylist(playlist: ApiPlaylist) {
    setImporting(true);
    try {
      const { added } = await importPlaylist(eventId, playlist.id, token);
      const updated = await getBoard(eventId, token);
      setBoard(updated);
      setPlaylistPickerVisible(false);
      showToast({
        type: 'success',
        message: added > 0 ? `Added ${added} track${added > 1 ? 's' : ''} from "${playlist.name}"` : 'All tracks were already in this event',
      });
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to import playlist' });
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const tracks = board?.tracks ?? [];

  return (
    <Screen scroll={false} padded={false}>
      <FlatList
        data={tracks}
        keyExtractor={(t) => String(t.trackId)}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          // header name status now playing suggest box
          <View style={styles.header}>
            <Text style={typography.h1}>{event?.name ?? 'Track Vote'}</Text>
            <Text style={styles.subtitle}>
              Vote for the next track — the more votes, the sooner it plays.
            </Text>
            {event && <StatusBanner event={event} />}
            {board?.nowPlaying && (
              <NowPlayingCard
                nowPlaying={board.nowPlaying}
                listeningAlong={listeningAlong}
                isPlaying={isPlaying && activeTrack?.id === String(board.nowPlaying.trackId)}
                onJoin={joinListening}
              />
            )}
            {/* suggest a track (search or add a whole playlist) */}
            <View style={styles.suggestBox}>
              <View style={styles.suggestTitleRow}>
                <Text style={styles.suggestTitle}>Suggest a track</Text>
                <Button
                  title="Add a playlist"
                  icon="albums-outline"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={openPlaylistPicker}
                />
              </View>
              <TrackSearch onSelect={suggest} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="bar-chart-outline"
            title="No tracks yet"
            message="Suggest the first track above to start the vote."
          />
        }
        // one vote row per track (rank = index + 1)
        renderItem={({ item, index }) => (
          <VoteRow
            rank={index + 1}
            track={item}
            onVote={() => toggleVote(item)}
            voting={voting === item.trackId}
            isNowPlaying={board?.nowPlaying?.trackId === item.trackId}
          />
        )}
      />

      {/* settings modal (owner only) */}
      {event?.isOwner && (
        <EventSettingsModal
          visible={settingsVisible}
          event={event}
          token={token}
          onClose={() => setSettingsVisible(false)}
          onUpdated={(updated) => setEvent(updated)}
          onDeleted={() => {
            setSettingsVisible(false);
            navigation.goBack();
          }}
        />
      )}

      {/* playlist picker to import (tap outside = close) */}
      <Modal
        visible={playlistPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPlaylistPickerVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setPlaylistPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={typography.h3}>Add a playlist</Text>
            <FlatList
              data={myPlaylists}
              keyExtractor={(p) => String(p.id)}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <PressableCard
                  style={styles.pickerRow}
                  onPress={() => importFromPlaylist(item)}
                  disabled={importing}
                  accessibilityLabel={item.name}
                >
                  <Text style={styles.pickerRowText} numberOfLines={1}>{item.name}</Text>
                  {importing ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  )}
                </PressableCard>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// banner with my role and why I can or cant vote
function StatusBanner({ event }: { event: ApiEvent }) {
  const roleLabel = event.isOwner
    ? { icon: 'star' as const, text: 'You created this event', color: colors.accent }
    : event.isInvited
      ? { icon: 'mail' as const, text: "You've been invited to this event", color: '#22d3ee' }
      : null;

  const voteHint = !event.canVote
    ? event.licenseMode === 'invite-only'
      ? "You need an invite to vote here"
      : event.licenseMode === 'geo-time-restricted'
        ? "Voting is closed right now (outside the time window)"
        : "You can't vote in this event"
    : event.licenseMode === 'geo-time-restricted'
      ? 'Your location will be checked when you vote'
      : null;

  // nothing to say = no banner
  if (!roleLabel && !voteHint) return null;

  return (
    <View style={styles.statusBox}>
      {roleLabel && (
        <View style={styles.statusRow}>
          <Ionicons name={roleLabel.icon} size={14} color={roleLabel.color} />
          <Text style={[styles.statusText, { color: roleLabel.color }]}>{roleLabel.text}</Text>
        </View>
      )}
      {voteHint && (
        <View style={styles.statusRow}>
          <Ionicons
            name={event.canVote ? 'information-circle' : 'lock-closed'}
            size={14}
            color={event.canVote ? colors.textSecondary : colors.warning}
          />
          <Text style={[styles.statusText, !event.canVote && { color: colors.warning }]}>{voteHint}</Text>
        </View>
      )}
    </View>
  );
}

// card of the track playing now + listen button + progress bar
function NowPlayingCard({
  nowPlaying,
  listeningAlong,
  isPlaying,
  onJoin,
}: {
  nowPlaying: VoteNowPlaying;
  listeningAlong: boolean;
  isPlaying: boolean;
  onJoin: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - nowPlaying.startedAt;
      setProgress(Math.max(0, Math.min(1, elapsed / nowPlaying.durationMs)));
    }
    tick();
    // refresh the progress 4 times per second
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [nowPlaying.trackId, nowPlaying.startedAt, nowPlaying.durationMs]);

  return (
    <View style={styles.nowPlayingCard}>
      <View style={styles.nowPlayingRow}>
        <View style={styles.nowPlayingArt}>
          {nowPlaying.cover ? (
            <Image source={{ uri: nowPlaying.cover }} style={styles.artImg} />
          ) : (
            <Ionicons name="musical-note" size={20} color={colors.accent} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
          <Text style={styles.title} numberOfLines={1}>{nowPlaying.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{nowPlaying.artist}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
        {!listeningAlong ? (
          <Button title="Listen" icon="play" size="sm" fullWidth={false} onPress={onJoin} />
        ) : (
          // le volume se regle depuis le lecteur en bas de l'app (MiniPlayer) :
          // c'est le meme lecteur partage, pas la peine de dupliquer le controle ici.
          <Ionicons
            name={isPlaying ? 'volume-high' : 'volume-mute'}
            size={20}
            color={isPlaying ? colors.accent : colors.textTertiary}
          />
        )}
      </View>
    </View>
  );
}

// one row of the board (rank cover title vote arrow + count)
function VoteRow({
  rank,
  track,
  onVote,
  voting,
  isNowPlaying,
}: {
  rank: number;
  track: VoteBoardTrack;
  onVote: () => void;
  voting: boolean;
  isNowPlaying: boolean;
}) {
  return (
    <PressableCard
      style={[styles.row, track.myVote && styles.rowActive, isNowPlaying && styles.rowPlaying]}
      onPress={onVote}
      disabled={voting}
    >
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.art}>
        {track.cover ? (
          <Image source={{ uri: track.cover }} style={styles.artImg} />
        ) : (
          <Text style={styles.artText}>{track.title[0]?.toUpperCase() ?? '?'}</Text>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          {isNowPlaying && <Ionicons name="volume-high" size={12} color={colors.accent} />}
          <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        </View>
        <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
      </View>
      <View style={styles.voteWrap}>
        {voting ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <>
            <Ionicons
              name={track.myVote ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
              size={26}
              color={track.myVote ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.voteCount, track.myVote && { color: colors.accent }]}>{track.voteCount}</Text>
          </>
        )}
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { marginBottom: spacing.md },
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  statusBox: { marginTop: spacing.sm, marginBottom: spacing.md, gap: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  suggestBox: { marginBottom: spacing.md },
  suggestTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.sm },
  suggestTitle: { ...typography.h3 },

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
  rowActive: { borderColor: colors.accent },
  rowPlaying: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rank: { width: 20, textAlign: 'center', color: colors.textSecondary, fontSize: 14, fontVariant: ['tabular-nums'] },
  art: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artImg: { width: '100%', height: '100%' },
  artText: { color: colors.textSecondary, fontSize: 18, fontWeight: '800' },
  info: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  artist: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  voteWrap: { alignItems: 'center', minWidth: 36 },
  voteCount: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 2 },

  nowPlayingCard: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  nowPlayingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nowPlayingArt: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nowPlayingLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },

  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  pickerCard: {
    width: '100%',
    maxWidth: layout.maxWidthNarrow,
    maxHeight: '70%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.floating,
  },
  pickerList: { marginTop: spacing.md },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  pickerRowText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1, marginRight: spacing.sm },
});
