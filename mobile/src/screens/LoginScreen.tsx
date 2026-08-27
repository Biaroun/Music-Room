import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Field from '../components/Field';
import Button from '../components/Button';

export default function LoginScreen({ navigation }: any) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();

  const canSubmit = login.trim().length > 0 && password.length > 0;

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      await authLogin(data.access_token);
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen narrow center>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="musical-notes" size={26} color={colors.onAccent} />
        </View>
        <Text style={typography.h1}>Music Room</Text>
        <Text style={[typography.caption, styles.tagline]}>Connect to your account</Text>
      </View>

      <Field
        label="Email or username"
        placeholder="you@example.com"
        value={login}
        onChangeText={setLogin}
        autoCapitalize="none"
        autoComplete="username"
        returnKeyType="next"
      />
      <Field
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <Button title="Login" onPress={handleLogin} loading={loading} disabled={!canSubmit} style={styles.submit} />

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.link}>
        <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>Forgot password?</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={typography.caption}>No account? </Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={[typography.caption, { color: colors.accent, fontWeight: '700' }]}>Register</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tagline: { marginTop: spacing.xs },
  submit: { marginTop: spacing.md },
  link: { alignSelf: 'center', marginTop: spacing.lg, padding: spacing.xs, cursor: 'pointer' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg, cursor: 'pointer' },
});
