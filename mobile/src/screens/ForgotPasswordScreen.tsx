import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../config/theme';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';

// écran mot de passe oublié : on saisit l'email, le back envoie un lien de reset par mail.
// route /auth/forgot-password à faire côté back (Biaroun), en attendant l'appel échoue juste.
export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit() {
    if (!email.trim())
      return;
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', null, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      // message neutre exprès, on dit pas si l'email existe (sécu)
      showToast({
        type: 'success',
        message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
      });
      navigation.goBack();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[typography.h1, { marginBottom: spacing.xs }]}>Mot de passe oublié</Text>
      <Text style={[typography.caption, { marginBottom: spacing.xl, textAlign: 'center' }]}>
        Entre ton email, on t'envoie un lien pour réinitialiser ton mot de passe.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Envoi...' : 'Envoyer le lien'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
        <Text style={typography.caption}>
          <Text style={{ color: colors.accent }}>Retour à la connexion</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  button: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 24,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  link: {
    marginTop: spacing.lg,
  },
});
