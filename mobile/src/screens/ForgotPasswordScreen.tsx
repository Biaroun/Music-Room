import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Field from '../components/Field';
import Button from '../components/Button';

// on saisit l'email, le back envoie un lien de reset par mail. le lien ouvre
// une page servie par le back (GET /auth/reset-password) ou l'on choisit le
// nouveau mot de passe, puis on revient se connecter ici
export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // POST forgot password with the email then go back
  async function handleSubmit() {
    if (!email.trim())
      return;
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', null, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      // message neutre expres, on dit pas si l'email existe (secu)
      showToast({
        type: 'success',
        message: 'Si un compte existe avec cet email, un lien valable 15 minutes vient d\'être envoyé.',
      });
      navigation.goBack();
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen narrow center>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="key-outline" size={24} color={colors.accent} />
        </View>
        <Text style={[typography.h2, { textAlign: 'center' }]}>Mot de passe oublié</Text>
        <Text style={[typography.caption, styles.sub]}>
          Entre ton email, on t'envoie un lien pour réinitialiser ton mot de passe.
        </Text>
      </View>

      {/* email field + send and back buttons */}
      <Field
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        onSubmitEditing={handleSubmit}
      />

      <Button
        title="Envoyer le lien"
        onPress={handleSubmit}
        loading={loading}
        disabled={!email.trim()}
        style={{ marginTop: spacing.md }}
      />
      <Button
        title="Retour à la connexion"
        onPress={() => navigation.goBack()}
        variant="ghost"
        style={{ marginTop: spacing.sm }}
      />
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
});
