import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, layout, radius, shadows, spacing, typography } from '../config/theme';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';
import PressableCard from '../components/PressableCard';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  updateEvent,
  deleteEvent,
  listInvited,
  inviteToEvent,
  uninviteFromEvent,
  type ApiEvent,
  type EventVisibility,
  type EventLicenseMode,
  type InvitedUser,
} from '../lib/trackVote';

type SearchResult = { id: number; username: string };

type Props = {
  visible: boolean;
  event: ApiEvent;
  token: string | null;
  onClose: () => void;
  onUpdated: (event: ApiEvent) => void;
  onDeleted: () => void;
};

const VISIBILITY_OPTIONS: { value: EventVisibility; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'public', label: 'Public', icon: 'earth' },
  { value: 'private', label: 'Private', icon: 'lock-closed' },
];

const LICENSE_OPTIONS: { value: EventLicenseMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'open', label: 'Everyone', icon: 'globe-outline' },
  { value: 'invite-only', label: 'Invited only', icon: 'people-outline' },
  { value: 'geo-time-restricted', label: 'Location & time', icon: 'location-outline' },
];

export default function EventSettingsModal({ visible, event, token, onClose, onUpdated, onDeleted }: Props) {
  const { showToast } = useToast();
  const [name, setName] = useState(event.name);
  const [visibility, setVisibility] = useState<EventVisibility>(event.visibility);
  const [licenseMode, setLicenseMode] = useState<EventLicenseMode>(event.licenseMode);
  const [radiusMeters, setRadiusMeters] = useState(String(event.licenseRadiusMeters ?? 200));
  const [durationHours, setDurationHours] = useState('4');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(
    event.licenseLatitude != null && event.licenseLongitude != null
      ? { latitude: event.licenseLatitude, longitude: event.licenseLongitude }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [invited, setInvited] = useState<InvitedUser[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const needsInvites = visibility === 'private' || licenseMode === 'invite-only';

  useEffect(() => {
    if (!visible) return;
    setName(event.name);
    setVisibility(event.visibility);
    setLicenseMode(event.licenseMode);
    setRadiusMeters(String(event.licenseRadiusMeters ?? 200));
    listInvited(event.id, token)
      .then(setInvited)
      .catch(() => {});
  }, [visible, event]);

  async function useMyLocation() {
    setLocating(true);
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Location permission denied' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      showToast({ type: 'error', message: 'Could not get your location' });
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      showToast({ type: 'error', message: 'Event name cannot be empty' });
      return;
    }
    if (licenseMode === 'geo-time-restricted' && !position) {
      showToast({ type: 'error', message: 'Set a location for this event first' });
      return;
    }
    setSaving(true);
    try {
      const now = Date.now();
      const hours = parseFloat(durationHours) || 4;
      const patch =
        licenseMode === 'geo-time-restricted'
          ? {
              name: name.trim(),
              visibility,
              licenseMode,
              licenseLatitude: position!.latitude,
              licenseLongitude: position!.longitude,
              licenseRadiusMeters: parseInt(radiusMeters, 10) || 200,
              licenseStartsAt: new Date(now).toISOString(),
              licenseEndsAt: new Date(now + hours * 3600_000).toISOString(),
            }
          : { name: name.trim(), visibility, licenseMode };
      const updated = await updateEvent(event.id, token, patch);
      onUpdated(updated);
      showToast({ type: 'success', message: 'Event updated' });
      onClose();
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to update event' });
    } finally {
      setSaving(false);
    }
  }

  async function searchUsers(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`, token);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function invite(user: SearchResult) {
    try {
      await inviteToEvent(event.id, user.id, token);
      setInvited((prev) => [...prev, { id: user.id, invitee: { id: user.id, username: user.username } }]);
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to invite' });
    }
  }

  async function uninvite(userId: number) {
    try {
      await uninviteFromEvent(event.id, userId, token);
      setInvited((prev) => prev.filter((i) => i.invitee.id !== userId));
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to remove invite' });
    }
  }

  async function confirmDeleteEvent() {
    setConfirmDelete(false);
    try {
      await deleteEvent(event.id, token);
      onDeleted();
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to delete event' });
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <FlatList
            data={[1]}
            keyExtractor={() => 'settings'}
            renderItem={() => (
              <View>
                <View style={styles.titleRow}>
                  <Text style={typography.h3}>Event settings</Text>
                  <Pressable onPress={onClose} hitSlop={8}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <Text style={styles.sectionLabel}>Event name</Text>
                <TextInput
                  style={styles.searchInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Event name"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={255}
                />

                <Text style={styles.sectionLabel}>Visibility</Text>
                <View style={styles.optionRow}>
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <PressableCard
                      key={opt.value}
                      style={[styles.option, visibility === opt.value && styles.optionActive]}
                      onPress={() => setVisibility(opt.value)}
                    >
                      <Ionicons name={opt.icon} size={16} color={visibility === opt.value ? colors.accent : colors.textSecondary} />
                      <Text style={[styles.optionText, visibility === opt.value && { color: colors.accent }]}>{opt.label}</Text>
                    </PressableCard>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Who can vote</Text>
                <View style={styles.optionRow}>
                  {LICENSE_OPTIONS.map((opt) => (
                    <PressableCard
                      key={opt.value}
                      style={[styles.option, licenseMode === opt.value && styles.optionActive]}
                      onPress={() => setLicenseMode(opt.value)}
                    >
                      <Ionicons name={opt.icon} size={16} color={licenseMode === opt.value ? colors.accent : colors.textSecondary} />
                      <Text style={[styles.optionText, licenseMode === opt.value && { color: colors.accent }]}>{opt.label}</Text>
                    </PressableCard>
                  ))}
                </View>

                {licenseMode === 'geo-time-restricted' && (
                  <View style={styles.geoBox}>
                    <Button
                      title={position ? 'Location set ✓' : 'Use my current location'}
                      variant="secondary"
                      size="sm"
                      icon="locate"
                      loading={locating}
                      onPress={useMyLocation}
                    />
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Radius (meters)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={radiusMeters}
                        onChangeText={setRadiusMeters}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Open for (hours)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={durationHours}
                        onChangeText={setDurationHours}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                )}

                {needsInvites && (
                  <View style={styles.inviteBox}>
                    <Text style={styles.sectionLabel}>Invited people</Text>
                    <TextInput
                      style={styles.searchInput}
                      value={query}
                      onChangeText={searchUsers}
                      placeholder="Search a username to invite…"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                    />
                    {searching && <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: spacing.sm }} />}
                    {results.map((u) => (
                      <View key={u.id} style={styles.inviteRow}>
                        <Text style={styles.inviteName}>{u.username}</Text>
                        <Pressable onPress={() => invite(u)} style={styles.inviteAction}>
                          <Text style={styles.inviteActionText}>Invite</Text>
                        </Pressable>
                      </View>
                    ))}
                    {invited.length > 0 && (
                      <View style={styles.invitedList}>
                        {invited.map((i) => (
                          <View key={i.invitee.id} style={styles.inviteRow}>
                            <Text style={styles.inviteName}>{i.invitee.username}</Text>
                            <Pressable onPress={() => uninvite(i.invitee.id)} hitSlop={8}>
                              <Ionicons name="close-circle" size={18} color={colors.danger} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <Button title="Save" onPress={save} loading={saving} style={{ marginTop: spacing.lg }} />
                <Button
                  title="Delete event"
                  variant="danger"
                  size="sm"
                  onPress={() => setConfirmDelete(true)}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            )}
          />
        </Pressable>
      </Pressable>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this event?"
        message="This cannot be undone. All votes and invites will be lost."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteEvent}
        onCancel={() => setConfirmDelete(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: layout.maxWidthNarrow,
    maxHeight: '85%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.floating,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.sm },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },

  geoBox: { marginTop: spacing.sm, gap: spacing.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: colors.textSecondary, fontSize: 13 },
  fieldInput: {
    width: 90,
    textAlign: 'right',
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },

  inviteBox: { marginTop: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
  },
  invitedList: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs + 2 },
  inviteName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  inviteAction: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
  inviteActionText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
});
