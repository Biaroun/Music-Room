import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { colors } from './src/config/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PreviewPlayerProvider } from './src/context/PreviewPlayerContext';
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
import TrackVoteScreen from './src/screens/TrackVoteScreen';
import MusicDelegationScreen from './src/screens/MusicDelegationScreen';


const Stack = createNativeStackNavigator();

function Navigation() {
  const { isAuthenticated, isLoading } = useAuth();
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
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Friends" component={FriendsScreen} options={{ headerShown: false }}/>
          <Stack.Screen name="Playlists" component={PlaylistsScreen} options={{ title: 'My Playlists' }} />
          <Stack.Screen name="PlaylistEditor" component={PlaylistEditorScreen} options={{ title: 'Playlist' }} />
          <Stack.Screen name="TrackVote" component={TrackVoteScreen} options={{ title: 'Track Vote' }} />
          <Stack.Screen name="MusicDelegation" component={MusicDelegationScreen} options={{ title: 'Music Delegation' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Mot de passe oublié' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <PreviewPlayerProvider>
          <NavigationContainer>
            <Navigation />
          </NavigationContainer>
          <MiniPlayer />
        </PreviewPlayerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}