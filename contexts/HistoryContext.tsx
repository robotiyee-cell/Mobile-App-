import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useSubscription } from './SubscriptionContext';

import { Language, useLanguage } from './LanguageContext';

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
  designMatch?: string;
  lang?: Language;
}

interface HistoryContextValue {
  items: HistoryItem[];
  isLoading: boolean;
  addItem: (item: HistoryItem) => Promise<void>;
  updateItem: (id: string, patch: Partial<HistoryItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  maxItems: number | -1;
  setUserIdForContext: (id: string | null) => void;
}

const STORAGE_KEY_BASE = 'l4f_history_items_v1';

export const [HistoryProvider, useHistory] = createContextHook<HistoryContextValue>(() => {
  const { subscription, plans } = useSubscription();
  const { language } = useLanguage();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);
  const translatingRef = useRef<boolean>(false);

  const planDef = useMemo(() => plans.find(p => p.id === subscription.tier), [plans, subscription.tier]);
  const maxItems = useMemo<number | -1>(() => {
    if (planDef?.hasUnlimitedHistory) return -1;
    if (subscription.tier === 'basic') return 25;
    return 5; // free default
  }, [planDef?.hasUnlimitedHistory, subscription.tier]);

  const key = `${STORAGE_KEY_BASE}${userId ? `_${userId}` : ''}`;

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
      const k = `${STORAGE_KEY_BASE}${userId ? `_${userId}` : ''}`;
      await AsyncStorage.setItem(k, JSON.stringify(data));
    } catch (e) {
      console.log('History persist error', e);
    }
  }, [userId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (maxItems === -1) return;
    setItems(prev => {
      if (prev.length <= maxItems) return prev;
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
      const k = `${STORAGE_KEY_BASE}${userId ? `_${userId}` : ''}`;
      await AsyncStorage.removeItem(k);
    } catch (e) {
      console.log('History clear error', e);
    }
  }, [userId]);

  const updateItem = useCallback(async (id: string, patch: Partial<HistoryItem>) => {
    setItems(prev => {
      const next = prev.map(i => (i.id === id ? { ...i, ...patch } : i));
      void persist(next);
      return next;
    });
  }, [persist]);

  const translateJsonSafely = async (jsonText: string, targetLang: Language): Promise<string | null> => {
    try {
      const isJson = !!jsonText && (jsonText.trim().startsWith('{') || jsonText.trim().startsWith('['));
      if (!isJson) return null;
      const res = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `You are a precise translator. Translate all human-readable text values in the given JSON into ${targetLang === 'tr' ? 'Turkish' : 'English'}. Preserve JSON structure and all numbers exactly. Return ONLY JSON.` },
            { role: 'user', content: jsonText }
          ]
        })
      });
      const data = await res.json();
      let completion: string | object = data?.completion ?? '';
      if (typeof completion === 'object') {
        return JSON.stringify(completion);
      }
      if (typeof completion === 'string') {
        let text = completion.trim();
        if (text.startsWith('```')) {
          text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
        }
        const first = text.indexOf('{');
        const last = text.lastIndexOf('}');
        const slice = first !== -1 && last !== -1 && last > first ? text.slice(first, last + 1) : text;
        JSON.parse(slice);
        return slice;
      }
      return null;
    } catch (e) {
      console.log('History translate error', e);
      return null;
    }
  };

  const translatePlainTextSafely = async (text: string, targetLang: Language): Promise<string | null> => {
    try {
      if (!text) return null;
      const res = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `Translate to ${targetLang === 'tr' ? 'Turkish' : 'English'} and return ONLY plain text. No markdown.` },
            { role: 'user', content: text }
          ]
        })
      });
      const data = await res.json();
      const completion = typeof data?.completion === 'string' ? data.completion : '';
      if (!completion) return null;
      let output = completion.trim();
      if (output.startsWith('```')) {
        output = output.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      }
      return output;
    } catch (e) {
      console.log('History translate plain error', e);
      return null;
    }
  };

  const extractSummary = (details: string | undefined): string | undefined => {
    if (!details) return undefined;
    try {
      const obj = JSON.parse(details) as any;
      if (obj && typeof obj === 'object') {
        if ('overallAnalysis' in obj && typeof obj.overallAnalysis === 'string') return obj.overallAnalysis as string;
        if ('style' in obj && typeof obj.style === 'string') return obj.style as string;
      }
    } catch {}
    return undefined;
  };

  useEffect(() => {
    const run = async () => {
      if (translatingRef.current) return;
      const need = items.filter(i => ((i?.details || i?.designMatch) && i.lang && i.lang !== language) || ((i?.details || i?.designMatch) && !i.lang));
      if (need.length === 0) return;
      translatingRef.current = true;
      try {
        const updated: HistoryItem[] = await Promise.all(
          items.map(async (it) => {
            if (it.lang === language) return it;
            let next: HistoryItem = { ...it };
            if (it.details) {
              const translated = await translateJsonSafely(it.details, language);
              if (translated) {
                const summary = extractSummary(translated) ?? it.analysisSummary;
                next = { ...next, details: translated, analysisSummary: summary };
              }
            }
            if (it.designMatch) {
              const dm = await translatePlainTextSafely(it.designMatch, language);
              if (dm) {
                next = { ...next, designMatch: dm };
              }
            }
            next.lang = language;
            return next;
          })
        );
        setItems(updated);
        void persist(updated);
      } catch (e) {
        console.log('History bulk translate failed', e);
      } finally {
        translatingRef.current = false;
      }
    };
    void run();
  }, [language, items, persist]);

  const setUserIdForContext = useCallback((id: string | null) => {
    setUserId(id);
  }, []);

  return {
    items,
    isLoading,
    addItem,
    updateItem,
    removeItem,
    clearHistory,
    maxItems,
    setUserIdForContext,
  };
});