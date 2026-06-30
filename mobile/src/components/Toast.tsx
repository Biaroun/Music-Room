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
