import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useSubscription } from './SubscriptionContext';

export type HistoryItemCategory = 'sexy' | 'elegant' | 'casual' | 'naive' | 'trendy' | 'anime' | 'sixties' | 'sarcastic' | 'custom' | 'all';

export interface HistoryItem {
  id: string;
  createdAt: string;
  imageUri: string;
  thumbnailUri?: string;
  selectedCategory: HistoryItemCategory;
  score?: number;
  analysisSummary?: string;
  details?: string;
}

interface HistoryContextValue {
  items: HistoryItem[];
  isLoading: boolean;
  addItem: (item: HistoryItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  maxItems: number | -1;
}

const STORAGE_KEY = 'l4f_history_items_v1';

export const [HistoryProvider, useHistory] = createContextHook<HistoryContextValue>(() => {
  const { subscription, plans } = useSubscription();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const planDef = useMemo(() => plans.find(p => p.id === subscription.tier), [plans, subscription.tier]);
  const maxItems = useMemo<number | -1>(() => {
    if (planDef?.hasUnlimitedHistory) return -1;
    if (subscription.tier === 'basic') return 25;
    return 5; // free default
  }, [planDef?.hasUnlimitedHistory, subscription.tier]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: HistoryItem[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.log('History load error', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persist = useCallback(async (data: HistoryItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.log('History persist error', e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (maxItems === -1) return;
    setItems(prev => {
      const trimmed = prev.slice(0, maxItems);
      void persist(trimmed);
      return trimmed;
    });
  }, [maxItems, persist]);

  const addItem = useCallback(async (item: HistoryItem) => {
    setItems(prev => {
      const next = [item, ...prev];
      const trimmed = maxItems === -1 ? next : next.slice(0, maxItems);
      void persist(trimmed);
      return trimmed;
    });
  }, [maxItems, persist]);

  const removeItem = useCallback(async (id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      void persist(next);
      return next;
    });
  }, [persist]);

  const clearHistory = useCallback(async () => {
    setItems([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log('History clear error', e);
    }
  }, []);

  return {
    items,
    isLoading,
    addItem,
    removeItem,
    clearHistory,
    maxItems,
  };
});