import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SubscriptionProvider, useSubscription } from "../contexts/SubscriptionContext";
import { LanguageProvider, useLanguage } from "../contexts/LanguageContext";
import { CreditsProvider } from "../contexts/CreditsContext";
import { HistoryProvider, useHistory } from "../contexts/HistoryContext";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { trpc, trpcClient } from "../lib/trpc";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function UserIdSync() {
  const { user } = useAuth();
  const { setUserIdForContext: setSubscriptionUserId } = useSubscription();
  const { setUserIdForContext: setLanguageUserId } = useLanguage();
  const { setUserIdForContext: setHistoryUserId } = useHistory();

  useEffect(() => {
    const id = user?.id ?? null;
    setSubscriptionUserId(id);
    setLanguageUserId(id);
    setHistoryUserId(id);
  }, [user?.id, setSubscriptionUserId, setLanguageUserId, setHistoryUserId]);

  return null;
}

function RootLayoutNav() {
  const { t } = useLanguage();
  return (
    <>
      <UserIdSync />
      <Stack screenOptions={{
            headerBackTitle: t('back'),
            headerTransparent: false,
            headerStyle: { backgroundColor: '#111827' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700', fontSize: 14 },
            headerShadowVisible: true,
          }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="settings" options={{ 
          title: t('settings'),
          headerTransparent: false,
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 14 },
          headerShadowVisible: true
        }} />
        <Stack.Screen name="design-match-test" options={{
          title: 'Design Match Test',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 14 },
        }} />
        <Stack.Screen name="terms" options={{
          title: t('termsTitle'),
          headerTransparent: false,
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 14 },
          headerShadowVisible: true
        }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <SubscriptionProvider>
              <CreditsProvider>
                <HistoryProvider>
                  <GestureHandlerRootView>
                    <RootLayoutNav />
                  </GestureHandlerRootView>
                </HistoryProvider>
              </CreditsProvider>
            </SubscriptionProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
