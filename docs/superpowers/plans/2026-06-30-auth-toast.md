# Auth Toast Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global Toast notification system and improve the Login/Register flow with visual feedback and a post-register redirect.

**Architecture:** A `ToastProvider` wraps the `NavigationContainer` in `App.tsx` and renders an absolutely-positioned toast at bottom-right. Any screen calls `useToast()` to trigger it. RegisterScreen navigates to Login on success (instead of auto-logging in), passing the email as a route param. LoginScreen accepts that param to pre-fill the email field.

**Tech Stack:** React Native, `@expo/vector-icons` (Ionicons), React Context API

## Global Constraints

- All icon usage via `Ionicons` from `@expo/vector-icons`
- Colors from `mobile/src/config/theme.ts` — success uses `#1DB954` (colors.accent), error uses `#f87171`
- No new dependencies to install
- No test framework in the project — verify manually by running `npx expo start --web`

---

### Task 1: Create `Toast.tsx` — context + UI component

**Files:**
- Create: `mobile/src/components/Toast.tsx`

**Interfaces:**
- Produces:
  - `ToastProvider: React.FC<{ children: React.ReactNode }>` — wraps app
  - `useToast(): { showToast: (opts: { type: 'success' | 'error'; message: string }) => void }`

---

- [ ] **Step 1: Create the file with full implementation**

Create `mobile/src/components/Toast.tsx` with this exact content:

```tsx
import React, { createContext, useContext, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error';

type ToastState = {
  visible: boolean;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (opts: { type: ToastType; message: string }) => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'success', message: '' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast({ type, message }: { type: ToastType; message: string }) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ visible: true, type, message });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  }

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(t => ({ ...t, visible: false }));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}
        {toast.visible && (
          <View style={[styles.toast, toast.type === 'error' && styles.toastError]}>
            <Ionicons
              name={toast.type === 'success' ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color="#fff"
              style={styles.icon}
            />
            <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
            <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    maxWidth: 300,
    backgroundColor: '#1DB954',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastError: {
    backgroundColor: '#f87171',
  },
  icon: {
    marginRight: 8,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/Toast.tsx
git commit -m "feat: add global ToastProvider and useToast hook"
```

---

### Task 2: Wire `ToastProvider` into `App.tsx`

**Files:**
- Modify: `mobile/App.tsx`

**Interfaces:**
- Consumes: `ToastProvider` from `./src/components/Toast`

---

- [ ] **Step 1: Add the import at the top of `App.tsx`**

After the existing imports, add:

```tsx
import { ToastProvider } from './src/components/Toast';
```

- [ ] **Step 2: Wrap `NavigationContainer` with `ToastProvider`**

Replace the `App()` return:

```tsx
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NavigationContainer>
          <Navigation />
        </NavigationContainer>
      </ToastProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Verify the app still starts**

Run: `npx expo start --web` (or `make dev-web`) and open the app.
Expected: app loads normally, no errors, login screen visible.

- [ ] **Step 4: Commit**

```bash
git add mobile/App.tsx
git commit -m "feat: wire ToastProvider into App root"
```

---

### Task 3: Update `RegisterScreen` — success flow + error toast

**Files:**
- Modify: `mobile/src/screens/RegisterScreen.tsx`

**Interfaces:**
- Consumes: `useToast` from `../components/Toast`
- Produces: on success, navigates to `'Login'` with param `{ email: string }`

---

- [ ] **Step 1: Replace the full content of `RegisterScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../config/theme';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';

export default function RegisterScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleRegister() {
    if (!username || !email || !password || !passwordConfirm) return;
    setLoading(true);
    try {
      await apiFetch('/auth/register', null, {
        method: 'POST',
        body: JSON.stringify({ username, email, password, passwordConfirm }),
      });
      showToast({ type: 'success', message: 'Account created! Please log in.' });
      navigation.navigate('Login', { email });
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[typography.h1, { marginBottom: spacing.xs }]}>Music Room</Text>
      <Text style={[typography.caption, { marginBottom: spacing.xl }]}>Create an account</Text>

      <TextInput style={styles.input} placeholder="Username" placeholderTextColor={colors.textSecondary}
        value={username} onChangeText={setUsername} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textSecondary}
        value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textSecondary}
        value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor={colors.textSecondary}
        value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Register'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
        <Text style={typography.caption}>Already have an account? <Text style={{ color: colors.accent }}>Login</Text></Text>
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
  link: { marginTop: spacing.lg },
});
```

- [ ] **Step 2: Manual verification**

Run the app, go to Register, fill in valid data and submit.
Expected: green toast appears at bottom-right "Account created! Please log in." and screen navigates to Login.

Then try submitting with an email already taken.
Expected: red toast appears with the error message from the API.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/screens/RegisterScreen.tsx
git commit -m "feat: register redirects to login with toast feedback"
```

---

### Task 4: Update `LoginScreen` — pre-fill email from params + toast feedback

**Files:**
- Modify: `mobile/src/screens/LoginScreen.tsx`

**Interfaces:**
- Consumes:
  - `useToast` from `../components/Toast`
  - `route.params?.email: string | undefined` — passed by RegisterScreen on success

---

- [ ] **Step 1: Replace the full content of `LoginScreen.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { useToast } from '../components/Toast';

export default function LoginScreen({ navigation, route }: any) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (route?.params?.email) {
      setLogin(route.params.email);
    }
  }, [route?.params?.email]);

  async function handleLogin() {
    if (!login || !password) return;
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      showToast({ type: 'success', message: 'Welcome back!' });
      await authLogin(data.access_token);
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
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
  link: {
    marginTop: spacing.lg,
  },
});
```

- [ ] **Step 2: Manual verification — coming from Register**

Run the app, create a new account on Register.
Expected: navigated to Login with email pre-filled, password field empty, user only needs to type password.

- [ ] **Step 3: Manual verification — bad credentials**

On the Login screen, type wrong password and submit.
Expected: red toast appears at bottom-right with the API error message.

- [ ] **Step 4: Manual verification — successful login**

Type correct credentials and submit.
Expected: green toast "Welcome back!" flashes briefly before the app navigates to Home.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/LoginScreen.tsx
git commit -m "feat: login accepts pre-filled email param and shows toast feedback"
```
