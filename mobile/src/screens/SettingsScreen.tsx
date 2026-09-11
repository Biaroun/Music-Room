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
import ConfirmDialog from '../components/ConfirmDialog';
import { subscribe, cancelSubscription, type SubscriptionPlan } from '../lib/subscription';
import GoogleLinkCard from '../components/GoogleLinkCard';

type Me = {
  id: number;
  username: string;
  email: string;
  emailisVerified: boolean;
  plan: SubscriptionPlan;
  subscribedAt: string | null;
  googleEmail: string | null;
  hasPassword: boolean;
};

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;

export default function SettingsScreen({ navigation }: any) {
  const { token, logout, refreshAccount } = useAuth();
  const { showToast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'subscribe' | 'cancel' | null>(null);

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
      setNewemail(''); setEmailPwd('');
      // la nouvelle adresse n'est pas verifiee : l'app bascule sur l'ecran de validation
      await refreshAccount();
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

  async function confirmSubscriptionChange() {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;
    setSubscribing(true);
    try {
      const status = action === 'subscribe' ? await subscribe(token) : await cancelSubscription(token);
      setMe((prev) => (prev ? { ...prev, plan: status.plan, subscribedAt: status.subscribedAt } : prev));
      showToast({
        type: 'success',
        message: action === 'subscribe' ? 'Premium activated — check your inbox' : 'Subscription cancelled — check your inbox',
      });
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setSubscribing(false);
    }
  }

  // validation affichee pendant la saisie plutot qu'en pop-up apres coup.
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

      <Text style={[typography.h2, ui.section]}>Linked accounts</Text>
      <GoogleLinkCard googleEmail={me?.googleEmail ?? null} hasPassword={!!me?.hasPassword} onChange={loadMe} />

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

      <Text style={[typography.h2, ui.section]}>Subscription</Text>
      <View style={ui.card}>
        <View style={styles.planRow}>
          <View style={[ui.badge, { backgroundColor: me?.plan === 'premium' ? colors.accentSoft : colors.surfaceAlt }]}>
            <Ionicons
              name={me?.plan === 'premium' ? 'star' : 'star-outline'}
              size={13}
              color={me?.plan === 'premium' ? colors.accent : colors.textSecondary}
            />
            <Text style={[ui.badgeText, { color: me?.plan === 'premium' ? colors.accent : colors.textSecondary }]}>
              {me?.plan === 'premium' ? 'Premium' : 'Free'}
            </Text>
          </View>
          <Text style={typography.caption}>
            {me?.plan === 'premium'
              ? 'You can create and manage Track Vote events.'
              : 'You can join and vote in Track Vote events. Upgrade to create and manage your own.'}
          </Text>
        </View>
        {me?.plan === 'premium' ? (
          <Button
            title="Cancel subscription"
            icon="close-circle-outline"
            variant="danger"
            onPress={() => setConfirmAction('cancel')}
            loading={subscribing}
            style={{ marginTop: spacing.sm }}
          />
        ) : (
          <Button
            title="Subscribe to Premium"
            icon="star"
            onPress={() => setConfirmAction('subscribe')}
            loading={subscribing}
            style={{ marginTop: spacing.sm }}
          />
        )}
      </View>

      <Text style={[typography.h2, ui.section]}>Session</Text>
      <Button title="Back to Home" icon="arrow-back" variant="secondary" onPress={() => navigation.goBack()} />
      <Button title="Log out" icon="log-out-outline" variant="danger" onPress={logout} style={{ marginTop: spacing.sm }} />

      <ConfirmDialog
        visible={confirmAction != null}
        title={confirmAction === 'subscribe' ? 'Subscribe to Premium?' : 'Cancel your subscription?'}
        message={
          confirmAction === 'subscribe'
            ? 'This is a demo confirmation — no real payment is taken. You will be able to create and manage Track Vote events.'
            : 'You will go back to the Free plan: you can still join and vote in events, but not create or manage new ones.'
        }
        confirmLabel={confirmAction === 'subscribe' ? 'Subscribe' : 'Cancel subscription'}
        destructive={confirmAction === 'cancel'}
        onConfirm={confirmSubscriptionChange}
        onCancel={() => setConfirmAction(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  planRow: { gap: spacing.sm },
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
