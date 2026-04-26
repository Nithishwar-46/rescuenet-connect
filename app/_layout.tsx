import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/error-boundary';

function RootNavigation() {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading || (user && profile === undefined)) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const onAuthScreen = !segments[0];
    const onOnboarding = segments[0] === 'onboarding';

    // 1. Not Logged In -> Forward to Login
    if (!user && !onAuthScreen) {
      router.replace('/');
    }
    // 2. Logged In -> Check Profile
    else if (user) {
      const isNew = profile?.full_name === 'New Responder' || profile?.full_name === 'New Admin' || !profile?.full_name;
      
      // If profile is new and not on onboarding -> Forward to Onboarding
      if (isNew && !onOnboarding) {
        router.replace('/onboarding' as any);
      }
      // If profile is ready and on auth/onboarding -> Forward to Dashboard
      else if (!isNew && (onAuthScreen || onOnboarding)) {
        router.replace('/(tabs)');
      }
    }
  }, [user, profile, loading, segments]);

  if (loading || (user && profile === undefined)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff4d4d" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Tactical Info' }} />
    </Stack>
  );
}

import { TacticalThemeProvider } from '@/lib/theme-context';
import { ToastProvider } from '@/lib/toast-provider';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <TacticalThemeProvider>
          <ToastProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <RootNavigation />
              <StatusBar style="auto" />
            </ThemeProvider>
          </ToastProvider>
        </TacticalThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
