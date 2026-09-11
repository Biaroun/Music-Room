import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { colors, radius, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';
import { apiFetch, getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Button from './Button';

type Props = {
  googleEmail: string | null;
  hasPassword: boolean;
  onChange: () => void;
};

// sujet v.1 : lier un compte google a un compte deja cree. meme flux que
// GoogleSignInButton, avec un ticket en plus pour que le back sache qui lie
export default function GoogleLinkCard({ googleEmail, hasPassword, onChange }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    try {
      const { ticket } = await apiFetch('/auth/google/link-ticket', token, { method: 'POST' });
      const appUrl = Platform.OS === 'web' ? globalThis.location?.origin : undefined;
      const result = await WebBrowser.openAuthSessionAsync(
        `${getApiUrl()}/auth/google/web?link=${encodeURIComponent(ticket)}`,
        appUrl,
      );
      if (result.type !== 'success')
        return;

      // le back renvoie ...#linked=1 ou ...#linkError=<message>
      const params = new URLSearchParams(result.url.split('#')[1] ?? '');
      if (params.get('linked')) {
        showToast({ type: 'success', message: 'Google account linked' });
        onChange();
      } else {
        showToast({ type: 'error', message: params.get('linkError') || 'Google linking failed' });
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setBusy(false);
    }
  }

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
