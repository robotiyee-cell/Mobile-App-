import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export interface CreditsState {
  totalCredits: number;
  usedCredits: number;
  lastUpdatedAt: string | null;
}

interface CreditsContextValue {
  credits: CreditsState;
  isLoading: boolean;
  addCredits: (amount: number) => Promise<void>;
  consumeCredits: (amount: number) => Promise<boolean>;
  resetCredits: () => Promise<void>;
}

const STORAGE_KEY = 'l4f_credits_v1';

export const [CreditsProvider, useCredits] = createContextHook<CreditsContextValue>(() => {
  const [credits, setCredits] = useState<CreditsState>({ totalCredits: 0, usedCredits: 0, lastUpdatedAt: null });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CreditsState = JSON.parse(raw);
        if (
          typeof parsed?.totalCredits === 'number' &&
          typeof parsed?.usedCredits === 'number'
        ) {
          setCredits({
            totalCredits: parsed.totalCredits,
            usedCredits: parsed.usedCredits,
            lastUpdatedAt: parsed.lastUpdatedAt ?? null,
          });
        }
      }
    } catch (e) {
      console.log('Credits load error', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persist = useCallback(async (data: CreditsState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.log('Credits persist error', e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCredits = useCallback(async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setCredits(prev => {
      const next: CreditsState = {
        totalCredits: prev.totalCredits + amount,
        usedCredits: prev.usedCredits,
        lastUpdatedAt: new Date().toISOString(),
      };
      void persist(next);
      return next;
    });
  }, [persist]);

  const consumeCredits = useCallback(async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    let ok = false;
    setCredits(prev => {
      const available = prev.totalCredits - prev.usedCredits;
      if (available >= amount) {
        ok = true;
        const next: CreditsState = {
          totalCredits: prev.totalCredits,
          usedCredits: prev.usedCredits + amount,
          lastUpdatedAt: new Date().toISOString(),
        };
        void persist(next);
        return next;
      }
      return prev;
    });
    return ok;
  }, [persist]);

  const resetCredits = useCallback(async () => {
    const next: CreditsState = { totalCredits: 0, usedCredits: 0, lastUpdatedAt: new Date().toISOString() };
    setCredits(next);
    await persist(next);
  }, [persist]);

  return useMemo(() => ({ credits, isLoading, addCredits, consumeCredits, resetCredits }), [credits, isLoading, addCredits, consumeCredits, resetCredits]);
});