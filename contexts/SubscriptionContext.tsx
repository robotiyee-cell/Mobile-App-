import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'ultimate';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  price: number;
  period: 'month' | 'year';
  features: string[];
  color: string;
  popular?: boolean;
  maxAnalyses: number;
  hasUnlimitedHistory: boolean;
  hasAdvancedAnalysis: boolean;
  hasPrioritySupport: boolean;
  hasCustomStyles: boolean;
  hasTrendInsights?: boolean;
}

export interface UserSubscription {
  tier: SubscriptionTier;
  expiresAt: Date | null;
  isActive: boolean;
  analysesUsed: number;
  analysesRemaining: number;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'month',
    features: [
      '3 outfit analyses per day',
      'Basic style categories',
      'Limited history (5 items)',
      'Standard support'
    ],
    color: '#9E9E9E',
    maxAnalyses: 3,
    hasUnlimitedHistory: false,
    hasAdvancedAnalysis: false,
    hasPrioritySupport: false,
    hasCustomStyles: false,
    hasTrendInsights: false
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 8,
    period: 'month',
    features: [
      '15 outfit analyses per day',
      'Basic style categories',
      'Extended history (25 items)',
      'Email support',
      'Export analysis results'
    ],
    color: '#4CAF50',
    maxAnalyses: 15,
    hasUnlimitedHistory: false,
    hasAdvancedAnalysis: false,
    hasPrioritySupport: false,
    hasCustomStyles: false,
    hasTrendInsights: false
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 16,
    period: 'month',
    features: [
      'Unlimited outfit analyses',
      'All categories (7 results)',
      'Unlimited history',
      'Detailed improvement suggestions',
      'Email support',
      'Export analysis results'
    ],
    color: '#FF9800',
    popular: true,
    maxAnalyses: -1,
    hasUnlimitedHistory: true,
    hasAdvancedAnalysis: false,
    hasPrioritySupport: false,
    hasCustomStyles: false,
    hasTrendInsights: false
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: 64,
    period: 'month',
    features: [
      'Everything in Premium',
      'Advanced AI Analysis',
      'Priority support',
      'Style trend insights',
      'Early access to new features'
    ],
    color: '#9C27B0',
    maxAnalyses: -1,
    hasUnlimitedHistory: true,
    hasAdvancedAnalysis: true,
    hasPrioritySupport: true,
    hasCustomStyles: false,
    hasTrendInsights: true
  }
];

const STORAGE_KEYS = {
  SUBSCRIPTION: 'user_subscription',
  ANALYSIS_COUNT: 'daily_analysis_count',
  LAST_RESET_DATE: 'last_reset_date'
};

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const [subscription, setSubscription] = useState<UserSubscription>({
    tier: 'premium',
    expiresAt: null,
    isActive: true,
    analysesUsed: 0,
    analysesRemaining: -1
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadSubscriptionData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load subscription info
      const savedSubscription = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
      if (savedSubscription) {
        try {
          const parsed = JSON.parse(savedSubscription);
          const sub: UserSubscription = {
            ...parsed,
            expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null
          };
        
          // Check if subscription is still active
          if (sub.expiresAt && sub.expiresAt < new Date()) {
            sub.tier = 'free';
            sub.isActive = false;
            sub.expiresAt = null;
          }
          
          setSubscription(sub);
        } catch (parseError) {
          console.error('Error parsing subscription data:', parseError);
          // Clear corrupted data and reset to default
          await AsyncStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION);
        }
      }
      
      // Load daily analysis count
      const analysisCount = await AsyncStorage.getItem(STORAGE_KEYS.ANALYSIS_COUNT);
      if (analysisCount) {
        const count = parseInt(analysisCount, 10);
        setSubscription(prev => ({
          ...prev,
          analysesUsed: count,
          analysesRemaining: prev.tier === 'free' ? Math.max(0, 3 - count) : 
                           prev.tier === 'basic' ? Math.max(0, 15 - count) : -1
        }));
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSubscriptionData = useCallback(async (newSubscription: UserSubscription) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(newSubscription));
    } catch (error) {
      console.error('Error saving subscription data:', error);
    }
  }, []);

  const resetAnalysisCount = useCallback(async () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.tier);
    const maxAnalyses = plan?.maxAnalyses || 3;
    
    const updatedSubscription = {
      ...subscription,
      analysesUsed: 0,
      analysesRemaining: maxAnalyses === -1 ? -1 : maxAnalyses
    };
    
    setSubscription(updatedSubscription);
    await AsyncStorage.setItem(STORAGE_KEYS.ANALYSIS_COUNT, '0');
  }, [subscription]);

  // Load subscription data on mount
  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  // Reset daily analysis count at midnight
  useEffect(() => {
    const checkDailyReset = async () => {
      const today = new Date().toDateString();
      const lastResetDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_RESET_DATE);
      
      if (lastResetDate !== today) {
        await resetAnalysisCount();
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_RESET_DATE, today);
      }
    };

    checkDailyReset();
    
    // Set up daily reset timer
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const timeout = setTimeout(() => {
      resetAnalysisCount();
      // Set up recurring daily reset
      const interval = setInterval(resetAnalysisCount, 24 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, [resetAnalysisCount]);

  const subscribeTo = useCallback(async (planId: SubscriptionTier): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const current = SUBSCRIPTION_PLANS.find(p => p.id === subscription.tier);
      const target = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!target) return false;

      const isDowngradeOrSame = current && current.price >= target.price;

      if (!isDowngradeOrSame) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const plan = target;
      
      const expiresAt = planId === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const newSubscription: UserSubscription = {
        tier: planId,
        expiresAt,
        isActive: true,
        analysesUsed: subscription.analysesUsed,
        analysesRemaining: plan.maxAnalyses === -1 ? -1 : Math.max(0, plan.maxAnalyses - subscription.analysesUsed)
      };
      
      setSubscription(newSubscription);
      await saveSubscriptionData(newSubscription);
      
      return true;
    } catch (error) {
      console.error('Error subscribing:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveSubscriptionData, subscription.analysesUsed, subscription.tier]);

  const cancelSubscription = useCallback(async () => {
    try {
      const newSubscription: UserSubscription = {
        tier: 'free',
        expiresAt: null,
        isActive: true,
        analysesUsed: subscription.analysesUsed,
        analysesRemaining: Math.max(0, 3 - subscription.analysesUsed)
      };
      
      setSubscription(newSubscription);
      await saveSubscriptionData(newSubscription);
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  }, [subscription.analysesUsed, saveSubscriptionData]);

  const restoreSubscription = useCallback(async () => {
    // In a real app, this would check with the payment provider
    // For now, we'll just reload from storage
    await loadSubscriptionData();
  }, [loadSubscriptionData]);

  const canAnalyze = useCallback((): boolean => {
    if (subscription.tier === 'premium' || subscription.tier === 'ultimate') {
      return true; // unlimited
    }
    return subscription.analysesRemaining > 0;
  }, [subscription.tier, subscription.analysesRemaining]);

  const incrementAnalysisCount = useCallback(async () => {
    const newCount = subscription.analysesUsed + 1;
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.tier);
    const maxAnalyses = plan?.maxAnalyses || 3;
    
    const updatedSubscription = {
      ...subscription,
      analysesUsed: newCount,
      analysesRemaining: maxAnalyses === -1 ? -1 : Math.max(0, maxAnalyses - newCount)
    };
    
    setSubscription(updatedSubscription);
    await AsyncStorage.setItem(STORAGE_KEYS.ANALYSIS_COUNT, newCount.toString());
  }, [subscription]);

  return useMemo(() => ({
    subscription,
    plans: SUBSCRIPTION_PLANS,
    isLoading,
    subscribeTo,
    cancelSubscription,
    restoreSubscription,
    canAnalyze,
    incrementAnalysisCount,
    resetAnalysisCount
  }), [subscription, isLoading, subscribeTo, cancelSubscription, restoreSubscription, canAnalyze, incrementAnalysisCount, resetAnalysisCount]);
});