import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SubscriptionProvider } from "../contexts/SubscriptionContext";
import { LanguageProvider } from "../contexts/LanguageContext";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ 
        title: "L4F Premium",
        headerTransparent: true,
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' }
      }} />
      <Stack.Screen name="settings" options={{ 
        title: "Settings",
        headerTransparent: true,
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' }
      }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <SubscriptionProvider>
          <GestureHandlerRootView>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </SubscriptionProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
