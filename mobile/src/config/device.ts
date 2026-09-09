import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

/**
 * sujet v.6 : chaque action mobile doit generer un log portant la plateforme,
 * l'appareil et la version. les trois valeurs ne bougent pas pendant la vie du
 * process, donc calculees une seule fois ici.
 * a garder aligne sur backend/src/logs/client-context.ts.
 */
export const PLATFORM_HEADER = 'x-client-platform';
export const DEVICE_HEADER = 'x-client-device';
export const APP_VERSION_HEADER = 'x-client-app-version';

function platformLabel(): string {
    // Device.osVersion est null sur le web, ou Platform.Version vaut le user
    // agent : trop gros pour la colonne
    const version = Device.osVersion;
    return version ? `${Platform.OS} ${version}` : Platform.OS;
}

function deviceLabel(): string {
    // modelName vaut "Pixel 7" ou "iPhone 15", null sur le web et sur certains
    // emulateurs, d'ou le repli
    return Device.modelName ?? Device.deviceName ?? 'unknown';
}

function appVersion(): string {
    return Constants.expoConfig?.version ?? 'unknown';
}

export const DEVICE_CONTEXT = {
    platform: platformLabel(),
    device: deviceLabel(),
    appVersion: appVersion(),
};

/** en-tetes joints a chaque requete http */
export const deviceHeaders: Record<string, string> = {
    [PLATFORM_HEADER]: DEVICE_CONTEXT.platform,
    [DEVICE_HEADER]: DEVICE_CONTEXT.device,
    [APP_VERSION_HEADER]: DEVICE_CONTEXT.appVersion,
};
