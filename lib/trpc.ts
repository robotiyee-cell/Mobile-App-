import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/$/, "");
  }
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
  } catch (e) {
    console.log('[trpc] window origin detection failed', e);
  }
  try {
    // Fallback for Expo Go on device: try to infer from debugger host if available
    const debuggerHost = (global as any)?.__fbBatchedBridgeConfig ? undefined : undefined;
    // If we can't infer, log helpful message
  } catch {}
  console.log('[trpc] EXPO_PUBLIC_RORK_API_BASE_URL not set. Defaulting to http://localhost:8080 (override with env for device).');
  return 'http://localhost:8080';
};

export const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
});