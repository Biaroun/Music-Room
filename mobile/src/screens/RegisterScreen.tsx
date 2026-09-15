import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography } from '../config/theme';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Field from '../components/Field';
import Button from '../components/Button';
import GoogleSignInButton from '../components/GoogleSignInButton';

// register screen (username email password confirm)
export default function RegisterScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // retour immediat sur la confirmation : plus lisible qu'une erreur apres l'envoi.
  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  // all fields filled AND the 2 passwords match
  const canSubmit = !!username && !!email && !!password && !!passwordConfirm && !mismatch;

  // POST register then back to login (the mail link is sent by the back)
  async function handleRegister() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await apiFetch('/auth/register', null, {
        method: 'POST',
        body: JSON.stringify({ username, email, password, passwordConfirm }),
      });
      showToast({ type: 'success', message: 'Account created! A verification link was sent to your inbox.' });
      navigation.navigate('Login', { email });
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen narrow center>
      <View style={styles.head}>
        <Text style={typography.h1}>Create an account</Text>
        <Text style={[typography.caption, { marginTop: spacing.xs }]}>Join Music Room in a few seconds</Text>
      </View>

      {/* register form */}
      <Field label="Username" placeholder="dj_tom" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <Field
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        hint="Min 12 characters, with upper, lower, number and special char."
      />
      <Field
        label="Confirm password"
        placeholder="••••••••"
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        secureTextEntry
        error={mismatch ? 'Passwords do not match' : null}
        onSubmitEditing={handleRegister}
      />

      <Button title="Register" onPress={handleRegister} loading={loading} disabled={!canSubmit} style={{ marginTop: spacing.md }} />

      <GoogleSignInButton label="Sign up with Google" />

      {/* link back to login */}
      <View style={styles.footer}>
        <Text style={typography.caption}>Already have an account? </Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[typography.caption, { color: colors.accent, fontWeight: '700' }]}>Login</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginBottom: spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg, cursor: 'pointer' },
});
