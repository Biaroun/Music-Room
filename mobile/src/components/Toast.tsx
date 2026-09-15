import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, shadows, spacing } from '../config/theme';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  visible: boolean;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (opts: { type: ToastType; message: string }) => void;
};

// default no op so useToast dont crash outside the provider
const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

// hook to show a toast from anywhere
export function useToast() {
  return useContext(ToastContext);
}

// colors and icon per toast type
const STYLE_BY_TYPE: Record<ToastType, { bg: string; fg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  success: { bg: colors.accent, fg: '#04150b', icon: 'checkmark-circle' },
  error: { bg: colors.danger, fg: '#2a0b0b', icon: 'alert-circle' },
  info: { bg: colors.surface, fg: colors.textPrimary, icon: 'information-circle' },
};

// one toast at a time on top of the app
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'success', message: '' });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // show a toast and hide it after 3 5s (a new one replace the old one)
  function showToast({ type, message }: { type: ToastType; message: string }) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ visible: true, type, message });
    timerRef.current = setTimeout(dismiss, 3500);
  }

  // hide the toast now
  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast((t) => ({ ...t, visible: false }));
  }

  // on anime l'entree/sortie plutot que d'apparaitre d'un coup : un toast qui surgit
  // sans transition passe souvent inapercu.
  useEffect(() => {
    Animated.timing(anim, {
      toValue: toast.visible ? 1 : 0,
      duration: toast.visible ? 220 : 160,
      easing: toast.visible ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.ease),
      // native driver dont exist on web
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [toast.visible]);

  // clear the timer on unmount (No leaks)
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const palette = STYLE_BY_TYPE[toast.type];

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}
        {toast.visible && (
          // en haut : le bas de l'ecran est deja pris par le mini-player et les fab
          <View style={[styles.wrap, { top: insets.top + spacing.md }]}>
            <Animated.View
              style={[
                styles.toast,
                { backgroundColor: palette.bg },
                {
                  opacity: anim,
                  // slide down from 24px above
                  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
                },
              ]}
            >
              <Ionicons name={palette.icon} size={18} color={palette.fg} />
              <Text style={[styles.message, { color: palette.fg }]} numberOfLines={3}>{toast.message}</Text>
              <Pressable onPress={dismiss} hitSlop={10} style={{ cursor: 'pointer' }}>
                <Ionicons name="close" size={16} color={palette.fg} />
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 999,
    // box-none : le toast ne doit pas bloquer les clics sur l'ecran en dessous
    pointerEvents: 'box-none',
  },
  toast: {
    width: '100%',
    maxWidth: layout.maxWidthNarrow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    ...shadows.floating,
  },
  message: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
});
