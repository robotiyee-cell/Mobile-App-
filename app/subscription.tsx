import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Crown, 
  Star, 
  Check, 
  Zap, 
  Heart, 
  Shield, 
  Sparkles,
  Gift,
  Users,
  MessageCircle,
  TrendingUp,
  Calendar,
  Infinity
} from 'lucide-react-native';
import { useSubscription, SubscriptionTier } from '../contexts/SubscriptionContext';
import { router } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';

export default function SubscriptionScreen() {
  const { subscription, plans, isLoading, subscribeTo } = useSubscription();
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async (planId: SubscriptionTier) => {
    if (planId === 'free') {
      router.back();
      return;
    }

    setIsSubscribing(true);
    setSelectedPlan(planId);

    try {
      const success = await subscribeTo(planId);
      if (success) {
        Alert.alert(
          t('successTitle'),
          t('successWelcome').replace('{plan}', plans.find(p => p.id === planId)?.name ?? ''),
          [
            {
              text: t('startAnalyzing'),
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert(t('error'), t('failedSubscription'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedSubscription'));
    } finally {
      setIsSubscribing(false);
      setSelectedPlan(null);
    }
  };

  const getPlanIcon = (planId: SubscriptionTier) => {
    switch (planId) {
      case 'free':
        return <Star size={24} color="white" />;
      case 'basic':
        return <Zap size={24} color="white" />;
      case 'premium':
        return <Crown size={24} color="white" />;
      case 'ultimate':
        return <Sparkles size={24} color="white" />;
      default:
        return <Star size={24} color="white" />;
    }
  };

  const getFeatureIcon = (feature: string) => {
    if (feature.includes('Unlimited') || feature.includes('unlimited')) {
      return <Infinity size={16} color="#4CAF50" />;
    }
    if (feature.includes('analyses') || feature.includes('analysis')) {
      return <Sparkles size={16} color="#FF9800" />;
    }
    if (feature.includes('support') || feature.includes('Priority')) {
      return <MessageCircle size={16} color="#2196F3" />;
    }
    if (feature.includes('history') || feature.includes('History')) {
      return <Calendar size={16} color="#9C27B0" />;
    }
    if (feature.includes('consultant') || feature.includes('recommendations')) {
      return <Users size={16} color="#E91E63" />;
    }
    if (feature.includes('trend') || feature.includes('insights')) {
      return <TrendingUp size={16} color="#FF5722" />;
    }
    if (feature.includes('community') || feature.includes('VIP')) {
      return <Heart size={16} color="#F44336" />;
    }
    if (feature.includes('Early access') || feature.includes('rewards')) {
      return <Gift size={16} color="#795548" />;
    }
    return <Check size={16} color="#4CAF50" />;
  };

  const renderCurrentPlan = () => {
    const currentPlan = plans.find(p => p.id === subscription.tier);
    if (!currentPlan) return null;

    return (
      <View style={styles.currentPlanContainer}>
        <LinearGradient
          colors={['#FF69B4', '#FFB6C1', '#FFC0CB']}
          style={styles.currentPlanGradient}
        >
          <View style={styles.currentPlanHeader}>
            <Shield size={24} color="white" />
            <Text style={styles.currentPlanTitle}>{t('currentPlan')}</Text>
          </View>
          <View style={styles.currentPlanInfo}>
            <Text style={styles.currentPlanName}>{currentPlan.name}</Text>
            {subscription.tier !== 'free' && subscription.expiresAt && (
              <Text style={styles.currentPlanExpiry}>
                {t('expires')} {subscription.expiresAt.toLocaleDateString()}
              </Text>
            )}
          </View>
          <View style={styles.usageInfo}>
            <Text style={styles.usageText}>
              {subscription.tier === 'premium' || subscription.tier === 'ultimate' 
                ? t('unlimitedAnalyses') 
                : (t('analysesRemaining') ?? '').replace('{count}', `${subscription.analysesRemaining}`)}
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF69B4" />
        <Text style={styles.loadingText}>{t('loadingPlans')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FF69B4', '#FFB6C1', '#FFC0CB']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Crown size={48} color="white" />
            <Text style={styles.headerTitle}>{t('upgradeToPremiumHeader')}</Text>
            <Text style={styles.headerSubtitle}>
              {t('upgradeToPremiumSub')}
            </Text>
          </View>
        </LinearGradient>

        {renderCurrentPlan()}

        <View style={styles.plansContainer}>
          <Text style={styles.plansTitle}>{t('chooseYourPlan')}</Text>
          <Text style={styles.plansSubtitle}>
            {t('chooseYourPlanSub')}
          </Text>

          <View style={styles.plansGrid}>
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  plan.popular && styles.popularPlan,
                  subscription.tier === plan.id && styles.currentPlanCard
                ]}
                onPress={() => handleSubscribe(plan.id)}
                disabled={isSubscribing}
              >
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{t('mostPopular')}</Text>
                  </View>
                )}

                <LinearGradient
                  colors={
                    plan.id === 'free' 
                      ? ['#9E9E9E', '#757575']
                      : plan.id === 'basic'
                      ? ['#4CAF50', '#388E3C']
                      : plan.id === 'premium'
                      ? ['#FF9800', '#F57C00']
                      : ['#9C27B0', '#7B1FA2']
                  }
                  style={styles.planHeader}
                >
                  <View style={styles.planIconContainer}>
                    {getPlanIcon(plan.id)}
                  </View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.planPricing}>
                    <Text style={styles.planPrice}>
                      {plan.price === 0 ? t('priceFree') : `${plan.price}`}
                    </Text>
                    {plan.price > 0 && (
                      <Text style={styles.planPeriod}>/{plan.period}</Text>
                    )}
                  </View>
                </LinearGradient>

                <View style={styles.planContent}>
                  <View style={styles.planFeatures}>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.featureItem}>
                        {getFeatureIcon(feature)}
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.subscribeButton,
                      subscription.tier === plan.id && styles.currentPlanButton,
                      { backgroundColor: plan.color }
                    ]}
                    onPress={() => handleSubscribe(plan.id)}
                    disabled={isSubscribing || subscription.tier === plan.id}
                  >
                    {isSubscribing && selectedPlan === plan.id ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        {subscription.tier === plan.id ? (
                          <Check size={20} color="white" />
                        ) : (
                          getPlanIcon(plan.id)
                        )}
                        <Text style={styles.subscribeButtonText}>
                          {subscription.tier === plan.id 
                            ? t('currentPlanCta') 
                            : plan.id === 'free' 
                            ? t('downgrade') 
                            : t('subscribe')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>{t('whyPremium')}</Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Sparkles size={24} color="#FF9800" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{t('benefitAdvancedAI')}</Text>
                <Text style={styles.benefitDescription}>
                  {t('benefitAdvancedAIDesc')}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Infinity size={24} color="#4CAF50" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{t('benefitUnlimited')}</Text>
                <Text style={styles.benefitDescription}>
                  {t('benefitUnlimitedDesc')}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Shield size={24} color="#2196F3" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{t('benefitPrivacy')}</Text>
                <Text style={styles.benefitDescription}>
                  {t('benefitPrivacyDesc')}
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Heart size={24} color="#E91E63" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{t('benefitGrowth')}</Text>
                <Text style={styles.benefitDescription}>
                  {t('benefitGrowthDesc')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('footerBullets')}
          </Text>
          <Text style={styles.footerSubtext}>
            {t('footerRenew')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE4E6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  currentPlanContainer: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  currentPlanGradient: {
    padding: 20,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentPlanTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  currentPlanInfo: {
    marginBottom: 12,
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  currentPlanExpiry: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  usageInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
  },
  usageText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  plansContainer: {
    padding: 20,
  },
  plansTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  plansSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  plansGrid: {
    gap: 16,
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    position: 'relative',
  },
  popularPlan: {
    borderWidth: 2,
    borderColor: '#FF9800',
    transform: Platform.OS === 'ios' ? [{ scale: 1.02 }] : [],
  },
  currentPlanCard: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  planHeader: {
    padding: 24,
    alignItems: 'center',
    marginTop: 0,
  },
  planIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 50,
    marginBottom: 12,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  planPeriod: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  planContent: {
    padding: 24,
  },
  planFeatures: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  currentPlanButton: {
    backgroundColor: '#4CAF50',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  benefitsSection: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    margin: 20,
    borderRadius: 16,
  },
  benefitsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 24,
  },
  benefitsList: {
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 12,
    borderRadius: 12,
    marginRight: 16,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});