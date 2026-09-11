import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Modal, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, layout, radius, shadows, spacing, typography } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';
import Screen, { useBottomInset } from '../components/Screen';
import PressableCard from '../components/PressableCard';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { listEvents, createEvent, type ApiEvent } from '../lib/trackVote';
import { listMyPlaylists, type ApiPlaylist } from '../lib/playlists';

export default function EventsScreen({ navigation }: any) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const bottomInset = useBottomInset();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<ApiPlaylist[]>([]);
  const [creating, setCreating] = useState(false);
  // bonus VI.3 : creer un event est reserve au plan premium. le backend est
  // la vraie limite (403 sinon), ceci n'est qu'un raccourci d'affichage pour
  // rediriger vers l'abonnement plutot que de laisser echouer l'appel.
  const [isPremium, setIsPremium] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listEvents(token)
        .then((data) => { if (active) setEvents(data); })
        .catch(() => { if (active) showToast({ type: 'error', message: 'Failed to load events' }); })
        .finally(() => { if (active) setLoading(false); });
      apiFetch('/users/me', token)
        .then((me) => { if (active) setIsPremium(me.plan === 'premium'); })
        .catch(() => {});
      return () => { active = false; };
    }, [token]),
  );

  async function openPicker() {
    if (!isPremium) {
      navigation.navigate('Settings');
      return;
    }
    try {
      const playlists = await listMyPlaylists(token);
      if (playlists.length === 0) {
        showToast({ type: 'error', message: 'Create a playlist first' });
        return;
      }
      setMyPlaylists(playlists);
      setPickerVisible(true);
    } catch {
      showToast({ type: 'error', message: 'Failed to load your playlists' });
    }
  }

  async function createFromPlaylist(playlist: ApiPlaylist) {
    setCreating(true);
    try {
      const event = await createEvent(token, { name: playlist.name, playlistId: playlist.id });
      setPickerVisible(false);
      navigation.navigate('TrackVote', { eventId: event.id });
    } catch {
      showToast({ type: 'error', message: 'Failed to create event' });
    } finally {
      setCreating(false);
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
    <Screen scroll={false} padded={false}>
      <FlatList
        data={events}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 88 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          events.length > 0 ? (
            <Text style={styles.intro}>
              Tap an event to vote. "You can vote" means you're allowed right now — some events need an invite,
              or being in the right place at the right time.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="bar-chart-outline"
            title="No events yet"
            message={
              isPremium
                ? 'Start an event from one of your playlists and let people vote for the next track.'
                : 'Free plan lets you join and vote in events. Upgrade to Premium to create and manage your own.'
            }
            actionLabel={isPremium ? 'New Event' : 'Upgrade to Premium'}
            onAction={openPicker}
          />
        }
        renderItem={({ item }) => (
          <PressableCard
            style={[styles.row, !item.canVote && styles.rowMuted]}
            onPress={() => navigation.navigate('TrackVote', { eventId: item.id })}
            accessibilityLabel={item.name}
          >
            <View style={[styles.art, item.canVote && styles.artCanVote]}>
              <Ionicons name="bar-chart" size={20} color={item.canVote ? colors.accent : colors.textSecondary} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons
                    name={item.visibility === 'public' ? 'earth' : 'lock-closed'}
                    size={10}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.badgeText}>{item.visibility === 'public' ? 'Public' : 'Private'}</Text>
                </View>
                {item.isOwner && (
                  <View style={[styles.badge, styles.badgeOwner]}>
                    <Ionicons name="star" size={10} color={colors.accent} />
                    <Text style={[styles.badgeText, { color: colors.accent }]}>Yours</Text>
                  </View>
                )}
                {item.isInvited && (
                  <View style={[styles.badge, styles.badgeInvited]}>
                    <Ionicons name="mail" size={10} color="#22d3ee" />
                    <Text style={[styles.badgeText, { color: '#22d3ee' }]}>Invited</Text>
                  </View>
                )}
                {item.licenseMode === 'geo-time-restricted' && (
                  <View style={styles.badge}>
                    <Ionicons name="location" size={10} color={colors.textSecondary} />
                    <Text style={styles.badgeText}>Location</Text>
                  </View>
                )}
              </View>
              <Text style={styles.meta}>by {item.owner.username}</Text>
            </View>
            <View style={styles.voteStatus}>
              <Ionicons
                name={item.canVote ? 'checkmark-circle' : 'close-circle-outline'}
                size={16}
                color={item.canVote ? colors.accent : colors.textTertiary}
              />
              <Text style={[styles.voteStatusText, item.canVote && { color: colors.accent }]}>
                {item.canVote ? 'You can vote' : "Can't vote"}
              </Text>
            </View>
          </PressableCard>
        )}
      />

      {events.length > 0 && (
        <View style={[styles.fabWrap, { bottom: bottomInset + spacing.md }]}>
          <Button
            title={isPremium ? 'New Event' : 'Upgrade to Premium'}
            icon={isPremium ? 'add' : 'star'}
            onPress={openPicker}
            style={[styles.fab, shadows.floating]}
          />
        </View>
      )}

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={typography.h3}>Choose a playlist</Text>
            <FlatList
              data={myPlaylists}
              keyExtractor={(p) => String(p.id)}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <PressableCard
                  style={styles.pickerRow}
                  onPress={() => createFromPlaylist(item)}
                  disabled={creating}
                  accessibilityLabel={item.name}
                >
                  <Text style={styles.pickerRowText} numberOfLines={1}>{item.name}</Text>
                  {creating ? (
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

const styles = StyleSheet.create({
  list: { padding: spacing.md, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  intro: { ...typography.caption, marginBottom: spacing.md, lineHeight: 17 },

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
  rowMuted: { opacity: 0.7 },
  art: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artCanVote: { backgroundColor: colors.accentSoft },
  info: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeOwner: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  badgeInvited: { borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.12)' },
  badgeText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  meta: { color: colors.textTertiary, fontSize: 11, marginTop: 4 },
  voteStatus: { alignItems: 'center', minWidth: 64 },
  voteStatusText: { color: colors.textTertiary, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },

  fabWrap: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', pointerEvents: 'box-none' },
  fab: { width: '100%', maxWidth: 320 },

  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
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
