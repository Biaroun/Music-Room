import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store n'existe pas sur le web → fallback localStorage.
export const storage = {
  getItem: (key: string): Promise<string | null> =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null)
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  removeItem: (key: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};
