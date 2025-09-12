import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SubscriptionProvider } from "../contexts/SubscriptionContext";
import { LanguageProvider, useLanguage } from "../contexts/LanguageContext";
import { CreditsProvider } from "../contexts/CreditsContext";
import { HistoryProvider } from "../contexts/HistoryContext";
import { trpc, trpcClient } from "../lib/trpc";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { t } = useLanguage();
  return (
    <Stack screenOptions={{
          headerBackTitle: t('backToCategories'),
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
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </trpc.Provider>
  );
}
