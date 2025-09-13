import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useSubscription } from './SubscriptionContext';
import { useAuth } from './AuthContext';

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

const STORAGE_KEY_BASE = 'l4f_history_items_v1';

export const [HistoryProvider, useHistory] = createContextHook<HistoryContextValue>(() => {
  const { subscription, plans } = useSubscription();
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const planDef = useMemo(() => plans.find(p => p.id === subscription.tier), [plans, subscription.tier]);
  const maxItems = useMemo<number | -1>(() => {
    if (planDef?.hasUnlimitedHistory) return -1;
    if (subscription.tier === 'basic') return 25;
    return 5; // free default
  }, [planDef?.hasUnlimitedHistory, subscription.tier]);

  const key = `${STORAGE_KEY_BASE}${user?.id ? `_${user.id}` : ''}`;

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const raw = await AsyncStorage.getItem(key);
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
      const k = `${STORAGE_KEY_BASE}${user?.id ? `_${user.id}` : ''}`;
      await AsyncStorage.setItem(k, JSON.stringify(data));
    } catch (e) {
      console.log('History persist error', e);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (maxItems === -1) return;
    setItems(prev => {
      if (prev.length <= maxItems) return prev;
      // Remove oldest items (from the end of the array since newest are at the beginning)
      const trimmed = prev.slice(0, maxItems);
      void persist(trimmed);
      return trimmed;
    });
  }, [maxItems, persist]);

  const addItem = useCallback(async (item: HistoryItem) => {
    setItems(prev => {
      // Add new item to the beginning (newest first)
      const next = [item, ...prev];
      // Trim to maxItems if there's a limit, removing oldest items
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
      const k = `${STORAGE_KEY_BASE}${user?.id ? `_${user.id}` : ''}`;
      await AsyncStorage.removeItem(k);
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