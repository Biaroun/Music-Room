import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch, getApiUrl } from '../config/api';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Field from '../components/Field';
import Button from '../components/Button';
import GoogleSignInButton from '../components/GoogleSignInButton';

// login screen (email or username + password google register forgot server)
export default function LoginScreen({ navigation }: any) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();
  const [server, setServer] = useState(getApiUrl());

  // relu au retour de l'ecran Server
  useEffect(() => navigation.addListener('focus', () => setServer(getApiUrl())), [navigation]);

  const canSubmit = login.trim().length > 0 && password.length > 0;

  // POST login then save the token (AuthContext switch to the app screens)
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
      {/* logo and title */}
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="musical-notes" size={26} color={colors.onAccent} />
        </View>
        <Text style={typography.h1}>Music Room</Text>
        <Text style={[typography.caption, styles.tagline]}>Connect to your account</Text>
      </View>

      {/* login form */}
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

      {/* google login forgot password and register links */}
      <GoogleSignInButton label="Continue with Google" />

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.link}>
        <Text style={[typography.caption, { color: colors.accent, fontWeight: '600' }]}>Forgot password?</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={typography.caption}>No account? </Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={[typography.caption, { color: colors.accent, fontWeight: '700' }]}>Register</Text>
        </Pressable>
      </View>

      {/* current server (without http) + link to change it */}
      <Pressable onPress={() => navigation.navigate('ServerSettings')} style={styles.server}>
        <Ionicons name="server-outline" size={12} color={colors.textTertiary} />
        <Text style={[typography.caption, { color: colors.textTertiary }]} numberOfLines={1}>
          {server.replace(/^https?:\/\//, '')} · change
        </Text>
      </Pressable>
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
  server: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    padding: spacing.xs,
    cursor: 'pointer',
  },
});
