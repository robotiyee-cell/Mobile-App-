import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, name?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'l4f_auth_user_v1';

export const [AuthProvider, useAuth] = createContextHook<AuthContextValue>(() => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: AuthUser = JSON.parse(raw);
          if (parsed && typeof parsed.id === 'string' && typeof parsed.email === 'string') {
            setUser(parsed);
          }
        }
      } catch (e) {
        console.log('Auth load error', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const signIn = useCallback(async (email: string, name?: string) => {
    try {
      const trimmed = (email ?? '').trim();
      if (!trimmed || !trimmed.includes('@')) return false;
      const u: AuthUser = { id: `u_${trimmed.toLowerCase()}`, email: trimmed.toLowerCase(), name: (name ?? '').trim() || undefined };
      setUser(u);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      return true;
    } catch (e) {
      console.log('signIn failed', e);
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setUser(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log('signOut failed', e);
    }
  }, []);

  return useMemo(() => ({ user, isLoading, signIn, signOut }), [user, isLoading, signIn, signOut]);
});