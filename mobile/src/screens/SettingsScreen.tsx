import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { ui } from '../config/ui';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Field from '../components/Field';
import Button from '../components/Button';

type Me = { id: number; username: string; email: string; emailisVerified: boolean };

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;

export default function SettingsScreen({ navigation }: any) {
  const { token, logout } = useAuth();
  const { showToast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const [newemail, setNewemail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');

  async function loadMe() {
    try { setMe(await apiFetch('/users/me', token)); }
    catch (e: any) { showToast({ type: 'error', message: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadMe(); }, []);

  async function changeEmail() {
    if (!newemail || !emailPwd) return;
    setSavingEmail(true);
    try {
      await apiFetch('/users/me/email', token, {
        method: 'PATCH',
        body: JSON.stringify({ newemail, currentpassword: emailPwd }),
      });
      showToast({ type: 'success', message: 'Email updated — check your inbox to verify it.' });
      setNewemail(''); setEmailPwd(''); loadMe();
    } catch (e: any) { showToast({ type: 'error', message: e.message }); }
    finally { setSavingEmail(false); }
  }

  async function changePassword() {
    if (!pwdFormValid) return;
    setSavingPwd(true);
    try {
      await apiFetch('/users/me/password', token, {
        method: 'PATCH',
        body: JSON.stringify({ currentpassword: curPwd, newpassword: newPwd, newpasswordConfirm: newPwdConfirm }),
      });
      showToast({ type: 'success', message: 'Password updated' });
      setCurPwd(''); setNewPwd(''); setNewPwdConfirm('');
    } catch (e: any) { showToast({ type: 'error', message: e.message }); }
    finally { setSavingPwd(false); }
  }

  // Validation affichée pendant la saisie plutôt qu'en pop-up après coup.
  const weakPwd = newPwd.length > 0 && !PASSWORD_RULE.test(newPwd);
  const mismatch = newPwdConfirm.length > 0 && newPwd !== newPwdConfirm;
  const pwdFormValid = !!curPwd && PASSWORD_RULE.test(newPwd) && newPwd === newPwdConfirm;

  if (loading) {
    return (
      <Screen scroll={false} center>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const verified = !!me?.emailisVerified;

  return (
    <Screen>
      <View style={styles.account}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{me?.username?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>{me?.username}</Text>
          <Text style={[typography.caption, { marginTop: 2 }]}>{me?.email}</Text>
          <View style={[ui.badge, { backgroundColor: verified ? colors.accentSoft : colors.surfaceAlt, marginTop: spacing.sm }]}>
            <Ionicons
              name={verified ? 'checkmark-circle' : 'alert-circle'}
              size={13}
              color={verified ? colors.accent : colors.warning}
            />
            <Text style={[ui.badgeText, { color: verified ? colors.accent : colors.warning }]}>
              {verified ? 'Email verified' : 'Email not verified'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[typography.h2, ui.section]}>Change email</Text>
      <View style={ui.card}>
        <Field
          label="New email"
          placeholder="you@example.com"
          value={newemail}
          onChangeText={setNewemail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Current password"
          placeholder="••••••••"
          value={emailPwd}
          onChangeText={setEmailPwd}
          secureTextEntry
        />
        <Button
          title="Update email"
          onPress={changeEmail}
          loading={savingEmail}
          disabled={!newemail || !emailPwd}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <Text style={[typography.h2, ui.section]}>Change password</Text>
      <View style={ui.card}>
        <Field label="Current password" placeholder="••••••••" value={curPwd} onChangeText={setCurPwd} secureTextEntry />
        <Field
          label="New password"
          placeholder="••••••••"
          value={newPwd}
          onChangeText={setNewPwd}
          secureTextEntry
          hint="Min 12 chars, with upper, lower, number and special char."
          error={weakPwd ? 'Min 12 chars, with upper, lower, number and special char.' : null}
        />
        <Field
          label="Confirm new password"
          placeholder="••••••••"
          value={newPwdConfirm}
          onChangeText={setNewPwdConfirm}
          secureTextEntry
          error={mismatch ? 'Passwords do not match' : null}
        />
        <Button
          title="Update password"
          onPress={changePassword}
          loading={savingPwd}
          disabled={!pwdFormValid}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <Text style={[typography.h2, ui.section]}>Session</Text>
      <Button title="Back to Home" icon="arrow-back" variant="secondary" onPress={() => navigation.goBack()} />
      <Button title="Log out" icon="log-out-outline" variant="danger" onPress={logout} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 22, fontWeight: '800' },
});
