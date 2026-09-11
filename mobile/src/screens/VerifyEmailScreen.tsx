import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { apiFetch } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Button from '../components/Button';

// sujet v.1 : un compte mail/mot de passe doit valider son adresse. tant que
// c'est pas fait, App.tsx n'expose que cet ecran
export default function VerifyEmailScreen() {
  const { token, account, refreshAccount, logout } = useAuth();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  // le lien s'ouvre dans le navigateur : au retour dans l'app on reverifie
  // tout seul, l'ecran disparait sans avoir a toucher un bouton
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active')
        refreshAccount();
    });
    return () => sub.remove();
  }, [token]);

  async function check() {
    setChecking(true);
    const next = await refreshAccount();
    setChecking(false);
    if (next && !next.emailisVerified)
      showToast({ type: 'error', message: 'Pas encore validé : clique sur le lien reçu par mail.' });
  }

  async function resend() {
    setSending(true);
    try {
      await apiFetch('/auth/resend-verification', token, { method: 'POST' });
      showToast({ type: 'success', message: 'Nouveau lien envoyé, il est valable 24 h.' });
    } catch (e: any) {
      const message = e.status === 429 ? 'Trop de demandes, réessaie dans une minute.' : e.message;
      showToast({ type: 'error', message });
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen narrow center>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="mail-unread-outline" size={24} color={colors.accent} />
        </View>
        <Text style={[typography.h2, { textAlign: 'center' }]}>Vérifie ton email</Text>
        <Text style={[typography.caption, styles.sub]}>
          On a envoyé un lien de validation à
        </Text>
        <Text style={[typography.body, styles.email]}>{account?.email}</Text>
        <Text style={[typography.caption, styles.sub]}>
          Ouvre-le pour activer ton compte, puis reviens ici.
        </Text>
      </View>

      <Button title="J'ai validé mon email" icon="checkmark-circle-outline" onPress={check} loading={checking} />
      <Button
        title="Renvoyer le mail"
        icon="refresh-outline"
        variant="secondary"
        onPress={resend}
        loading={sending}
        style={{ marginTop: spacing.sm }}
      />
      <Button title="Se déconnecter" variant="ghost" onPress={logout} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginBottom: spacing.lg },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sub: { textAlign: 'center', marginTop: spacing.xs, lineHeight: 18, maxWidth: 320 },
  email: { textAlign: 'center', fontWeight: '700', marginTop: spacing.xs },
});
