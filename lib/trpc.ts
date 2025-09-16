import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";
import Constants from "expo-constants";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    console.log('[trpc] Using EXPO_PUBLIC_RORK_API_BASE_URL', envUrl);
    return envUrl.replace(/\/$/, "");
  }

  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        console.log('[trpc] Using window.origin', window.location.origin);
        return window.location.origin;
      }
    } catch (e) {
      console.log('[trpc] window origin detection failed', e);
    }
  }

  try {
    const hostUri = (Constants?.expoConfig as any)?.hostUri as string | undefined;
    if (hostUri) {
      const [host, port = '80'] = hostUri.split(':');
      const scheme = 'http';
      const url = `${scheme}://${host}:${port}`.replace(/\/$/, "");
      console.log('[trpc] Using Expo hostUri', url);
      return url;
    }
  } catch (e) {
    console.log('[trpc] hostUri detection failed', e);
  }

  console.log('[trpc] EXPO_PUBLIC_RORK_API_BASE_URL not set. Defaulting to http://localhost:8081');
  return 'http://localhost:8081';
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});