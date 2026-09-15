import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { BUILD_API_URL, getApiUrl, normalizeApiUrl, probeApiUrl, setApiUrl } from '../config/api';
import { useToast } from '../components/Toast';
import Screen from '../components/Screen';
import Field from '../components/Field';
import Button from '../components/Button';

// sujet v.5 : adresse du back reglable dans l'app pour les tests. accessible
// depuis le login seulement : un token ne vaut que pour le back qui l'a signe
export default function ServerSettingsScreen({ navigation }: any) {
  const [input, setInput] = useState(getApiUrl());
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // null while the input is not a valid url (buttons disabled)
  const url = normalizeApiUrl(input);

  // just check if our api answer at this url
  async function test() {
    if (!url) return;
    setTesting(true);
    const ok = await probeApiUrl(url);
    setTesting(false);
    showToast(ok
      ? { type: 'success', message: 'Music Room API reachable' }
      : { type: 'error', message: 'No Music Room API at this address' });
  }

  // on refuse d'enregistrer une adresse qui ne repond pas : sinon l'app
  // echoue en silence au prochain login
  async function save() {
    if (!url) return;
    setSaving(true);
    const ok = await probeApiUrl(url);
    if (!ok) {
      setSaving(false);
      showToast({ type: 'error', message: 'No Music Room API at this address' });
      return;
    }
    // same as the build url = on stocke null (so a new build url still apply)
    await setApiUrl(url === BUILD_API_URL ? null : url);
    setSaving(false);
    showToast({ type: 'success', message: `Server set to ${url}` });
    navigation.goBack();
  }

  // back to the build url
  async function reset() {
    await setApiUrl(null);
    setInput(BUILD_API_URL);
    showToast({ type: 'success', message: 'Back to the default server' });
  }

  return (
    <Screen narrow center>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="server-outline" size={24} color={colors.accent} />
        </View>
        <Text style={[typography.h2, { textAlign: 'center' }]}>Server</Text>
        <Text style={[typography.caption, styles.sub]}>
          Address of the Music Room backend. On an Android emulator, the host machine is 10.0.2.2.
        </Text>
      </View>

      {/* url field then save test and reset buttons */}
      <Field
        label="Backend URL"
        placeholder="http://192.168.1.10:3000"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={input && !url ? 'Expected http(s)://host[:port]' : null}
        hint={`Default: ${BUILD_API_URL}`}
      />

      <Button title="Save" onPress={save} loading={saving} disabled={!url} style={{ marginTop: spacing.md }} />
      <Button
        title="Test connection"
        variant="secondary"
        icon="pulse-outline"
        onPress={test}
        loading={testing}
        disabled={!url}
        style={{ marginTop: spacing.sm }}
      />
      <Button title="Reset to default" variant="ghost" onPress={reset} style={{ marginTop: spacing.sm }} />
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
