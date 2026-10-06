import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';
import { apiFetch } from '../config/api';
import { linkGoogleAccount, runGoogleFlow } from '../lib/googleAuth';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Button from './Button';

type Props = {
  googleEmail: string | null;
  hasPassword: boolean;
  onChange: () => void;
};

export default function GoogleLinkCard({ googleEmail, hasPassword, onChange }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    try {
      const flow = await runGoogleFlow();
      // closed or canceled = nothing to do
      if (!flow)
        return;
      await linkGoogleAccount(token, flow);
      showToast({ type: 'success', message: 'Google account linked' });
      onChange();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setBusy(false);
    }
  }

  // remove the google link then refresh the profile
  async function unlink() {
    setBusy(true);
    try {
      await apiFetch('/auth/google/link', token, { method: 'DELETE' });
      showToast({ type: 'success', message: 'Google account unlinked' });
      onChange();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={ui.card}>
      {/* google icon + linked status */}
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.bodyStrong}>Google</Text>
          <Text style={[typography.caption, { marginTop: 2 }]}>
            {googleEmail ? `Linked to ${googleEmail}` : 'Not linked — sign in with Google next time'}
          </Text>
        </View>
      </View>

      {/* linked = unlink button (disabled without password) sinon link button */}
      {googleEmail ? (
        <>
          <Button
            title="Unlink Google"
            variant="secondary"
            onPress={unlink}
            loading={busy}
            disabled={!hasPassword}
            style={{ marginTop: spacing.md }}
          />
          {!hasPassword && (
            <Text style={[typography.caption, { marginTop: spacing.sm }]}>
              Your account has no password yet. Set one with "Forgot password?" before unlinking.
            </Text>
          )}
        </>
      ) : (
        <Button
          title="Link Google account"
          icon="link-outline"
          onPress={link}
          loading={busy}
          style={{ marginTop: spacing.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
