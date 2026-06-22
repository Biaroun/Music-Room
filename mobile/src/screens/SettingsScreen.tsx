import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { colors, typography, spacing } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';

type Me = { id: number; username: string; email: string; emailisVerified: boolean };

export default function SettingsScreen({ navigation }: any) {
  const { token, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newemail, setNewemail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');

  async function loadMe() {
    try { setMe(await apiFetch('/users/me', token)); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadMe(); }, []);

  async function changeEmail() {
    if (!newemail || !emailPwd) return;
    setSaving(true);
    try {
      await apiFetch('/users/me/email', token, {
        method: 'PATCH',
        body: JSON.stringify({ newemail, currentpassword: emailPwd }),
      });
      Alert.alert('Email updated', 'Check your inbox to verify the new address.');
      setNewemail(''); setEmailPwd(''); loadMe();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function changePassword() {
    if (!curPwd || !newPwd || !newPwdConfirm) return;
    if (newPwd !== newPwdConfirm) return Alert.alert('Error', 'Passwords do not match');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/.test(newPwd))
      return Alert.alert('Error', 'Min 12 chars, with upper, lower, number and special char.');
    setSaving(true);
    try {
      await apiFetch('/users/me/password', token, {
        method: 'PATCH',
        body: JSON.stringify({ currentpassword: curPwd, newpassword: newPwd, newpasswordConfirm: newPwdConfirm }),
      });
      Alert.alert('Success', 'Password updated');
      setCurPwd(''); setNewPwd(''); setNewPwdConfirm('');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  if (loading)
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={typography.h1}>Settings</Text>

      <View style={styles.card}>
        <Text style={typography.h2}>{me?.username}</Text>
        <Text style={typography.caption}>{me?.email}</Text>
        <View style={[styles.badge, { backgroundColor: me?.emailisVerified ? colors.accent : colors.surfaceAlt }]}>
          <Text style={styles.badgeText}>{me?.emailisVerified ? '✓ Email verified' : '✗ Email not verified'}</Text>
        </View>
      </View>

      <Text style={[typography.h2, styles.section]}>Change email</Text>
      <TextInput style={styles.input} placeholder="New email" placeholderTextColor={colors.textSecondary}
        value={newemail} onChangeText={setNewemail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={colors.textSecondary}
        value={emailPwd} onChangeText={setEmailPwd} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={changeEmail} disabled={saving}>
        <Text style={styles.buttonText}>Update email</Text></TouchableOpacity>

      <Text style={[typography.h2, styles.section]}>Change password</Text>
      <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={colors.textSecondary}
        value={curPwd} onChangeText={setCurPwd} secureTextEntry />
      <TextInput style={styles.input} placeholder="New password (min 12 chars)" placeholderTextColor={colors.textSecondary}
        value={newPwd} onChangeText={setNewPwd} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={colors.textSecondary}
        value={newPwdConfirm} onChangeText={setNewPwdConfirm} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={changePassword} disabled={saving}>
        <Text style={styles.buttonText}>Update password</Text></TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => navigation.goBack()}>
        <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Back to Home</Text></TouchableOpacity>
      <TouchableOpacity style={{ marginTop: spacing.lg, alignItems: 'center' }} onPress={logout}>
        <Text style={[typography.caption, { color: '#f87171' }]}>Log out</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginVertical: spacing.md },
  badge: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: 12 },
  badgeText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm, fontSize: 14 },
  button: { backgroundColor: colors.accent, borderRadius: 24, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  secondary: { backgroundColor: colors.surface },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
