import React from 'react';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/config/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PreviewPlayerProvider } from './src/context/PreviewPlayerContext';
import { RealtimeProvider } from './src/context/RealtimeContext';
import { ToastProvider } from './src/components/Toast';
import MiniPlayer from './src/components/MiniPlayer';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import PlaylistsScreen from './src/screens/PlaylistsScreen';
import PlaylistEditorScreen from './src/screens/PlaylistEditorScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import EventsScreen from './src/screens/EventsScreen';
import TrackVoteScreen from './src/screens/TrackVoteScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import ServerSettingsScreen from './src/screens/ServerSettingsScreen';


// the stack navigator for all the screens
const Stack = createNativeStackNavigator();

// Thème navigation aligné sur nos tokens : sans ça le fond par défaut (blanc) flashe
// entre deux transitions d'écran.
const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

// react-navigation masque l'écran sortant avec aria-hidden + display:none. Si le bouton
// qu'on vient de cliquer garde le focus, celui-ci se retrouve piégé dans un sous-arbre
// masqué (Chrome refuse alors le aria-hidden). On relâche le focus à chaque navigation.
function releaseFocusOnNavigate() {
  if (Platform.OS !== 'web') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

// choose the screens depending on the auth state (verify email app or login)
function Navigation() {
  const { isAuthenticated, isLoading, account } = useAuth();
  // logged but mail not verified = only the verify screen
  const mustVerifyEmail = isAuthenticated && account !== null && !account.emailisVerified;
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontSize: 17, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* 3 cases verify email screen OR the app OR the login screens */}
      {mustVerifyEmail ? (
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ headerShown: false }} />
      ) : isAuthenticated ? (
        <>
          {/* logged in screens */}
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Music Room' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
          <Stack.Screen name="Friends" component={FriendsScreen} options={{ headerShown: false }}/>
          <Stack.Screen name="Playlists" component={PlaylistsScreen} options={{ title: 'My Playlists' }} />
          <Stack.Screen name="PlaylistEditor" component={PlaylistEditorScreen} options={{ title: 'Playlist' }} />
          <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events' }} />
          <Stack.Screen name="TrackVote" component={TrackVoteScreen} options={{ title: 'Track Vote' }} />
        </>
      ) : (
        <>
          {/* not logged screens */}
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create an account' }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Mot de passe oublié' }} />
          <Stack.Screen name="ServerSettings" component={ServerSettingsScreen} options={{ title: 'Server' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

// root of the app (all the providers then the navigation + mini player)
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          {/* RealtimeProvider au-dessus du lecteur : c'est lui qui déclare l'écoute en cours */}
          <RealtimeProvider>
            <PreviewPlayerProvider>
              <StatusBar style="light" />
              <NavigationContainer theme={navTheme} onStateChange={releaseFocusOnNavigate}>
                <Navigation />
              </NavigationContainer>
              <MiniPlayer />
            </PreviewPlayerProvider>
          </RealtimeProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
