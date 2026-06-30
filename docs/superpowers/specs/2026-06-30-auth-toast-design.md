# Auth Toast Notifications — Design Spec

**Date:** 2026-06-30  
**Scope:** LoginScreen, RegisterScreen, new Toast system

---

## Problem

- RegisterScreen gives no visual feedback on success or failure (only `Alert.alert` on error, silent on success)
- LoginScreen only uses `Alert.alert` for errors — no success feedback
- After register, the user is auto-logged in with no confirmation; the intended flow is to redirect to Login with email pre-filled

---

## Solution Overview

Introduce a global `ToastContext` with a `Toast` component mounted above the navigation stack. Replace all `Alert.alert` calls in LoginScreen and RegisterScreen with `showToast()`. Change the register success flow to navigate to Login instead of auto-login.

---

## Architecture

### `src/components/Toast.tsx`

Single file containing:

- **`ToastContext`** — React context holding `showToast`
- **`ToastProvider`** — wraps children, manages toast state, renders the `Toast` UI
- **`useToast()`** — hook for any screen to trigger a toast

**Toast state shape:**
```ts
type ToastState = {
  visible: boolean;
  type: 'success' | 'error';
  message: string;
};
```

**Visual spec:**
- Position: absolute, bottom-right (`bottom: 32, right: 16`)
- Width: `maxWidth: 300`
- Background: `#1DB954` (success) / `#f87171` (error)
- Layout: row — icon + message text + close button
- Icon: Ionicons `checkmark-circle` (success) or `close-circle` (error), size 18
- Close button: Ionicons `close`, size 16
- Border radius: 12
- Padding: 12px vertical, 14px horizontal
- Auto-dismiss: `setTimeout` 3500ms, cleared on manual close or on new toast
- z-index: 999 (above everything)

### `App.tsx`

Wrap the navigator with `ToastProvider`:
```tsx
<ToastProvider>
  <NavigationContainer>...</NavigationContainer>
</ToastProvider>
```

---

## RegisterScreen changes

1. Remove `authLogin` import (no longer called on success)
2. On success:
   - `showToast({ type: 'success', message: 'Account created!' })`
   - `navigation.navigate('Login', { email })`
3. On error: `showToast({ type: 'error', message: e.message })` (remove `Alert`)

---

## LoginScreen changes

1. Accept `route` prop alongside `navigation`
2. On mount / param change: pre-fill `login` state from `route.params?.email` if present
3. On success: `showToast({ type: 'success', message: 'Welcome back!' })` before `authLogin`
4. On error: `showToast({ type: 'error', message: e.message })` (remove `Alert`)

---

## Files to create / modify

| File | Action |
|------|--------|
| `mobile/src/components/Toast.tsx` | Create |
| `mobile/App.tsx` | Wrap navigator with `ToastProvider` |
| `mobile/src/screens/RegisterScreen.tsx` | Modify success + error flow |
| `mobile/src/screens/LoginScreen.tsx` | Modify to accept params + toast |

---

## Out of scope

- Animations (slide-in/fade) — can be added later
- Toast queue (multiple toasts stacked) — single toast, new one replaces old
- Persistence across navigation — toast lives in the provider, dismisses on its own
