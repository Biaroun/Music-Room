import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors, typography, spacing } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';

export default function LoginScreen({ navigation }: any) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();

  async function handleLogin() {
    if (!login || !password)
      return;
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      await authLogin(data.access_token);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[typography.h1, { marginBottom: spacing.xs }]}>Music Room</Text>
      <Text style={[typography.caption, { marginBottom: spacing.xl }]}>
        Connect to your account
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email or username"
        placeholderTextColor={colors.textSecondary}
        value={login}
        onChangeText={setLogin}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Login'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.forgotLink} onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={[typography.caption, { color: colors.accent }]}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Register')}>
        <Text style={typography.caption}>No account? <Text style={{ color: colors.accent }}>Register</Text></Text>
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
  forgotLink: {
    marginTop: spacing.md,
  },
  link: {
    marginTop: spacing.lg,
  },
});
