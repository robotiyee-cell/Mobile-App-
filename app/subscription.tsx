import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
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
import { router, Stack } from 'expo-router';
import { useLanguage } from '../contexts/LanguageContext';

import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SubscriptionScreen() {
  const { subscription, plans, isLoading, subscribeTo } = useSubscription();
  const { t } = useLanguage();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [checkoutVisible, setCheckoutVisible] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [expiry, setExpiry] = useState<string>('');
  const [cvc, setCvc] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const [isRememberedUser, setIsRememberedUser] = useState<boolean>(false);

  const getPlanFeatures = (planId: SubscriptionTier): string[] => {
    if (planId === 'free') {
      return [t('freeFeature1'), t('freeFeature2'), t('freeFeature3'), t('freeFeature4')].filter(f => (f ?? '').toString().trim() !== '—');
    }
    if (planId === 'basic') {
      return [t('basicFeature1'), t('basicFeature2'), t('basicFeature3'), t('basicFeature4'), t('basicFeature5')].filter(f => (f ?? '').toString().trim() !== '—');
    }
    if (planId === 'premium') {
      return [t('premiumFeature1'), t('premiumFeature2'), t('premiumFeature3'), t('premiumFeature4'), t('premiumFeature5'), t('premiumFeature6'), t('premiumFeature7')].filter(f => (f ?? '').toString().trim() !== '—');
    }
    return [t('ultimateFeature1'), t('ultimateFeature2'), t('ultimateFeature3'), t('ultimateFeature4'), t('ultimateFeature5'), t('ultimateFeature6'), t('ultimateFeature7')].filter(f => (f ?? '').toString().trim() !== '—');
  };

  const validateCheckout = useCallback((): boolean => {
    if (!isRememberedUser) {
      if (!email || !email.includes('@')) {
        setFieldError(t('email'));
        return false;
      }
      if (!password || password.length < 6) {
        setFieldError(t('password'));
        return false;
      }
    }
    if (!firstName || firstName.trim().length < 2) {
      setFieldError(t('firstName'));
      return false;
    }
    if (!lastName || lastName.trim().length < 2) {
      setFieldError(t('surname'));
      return false;
    }
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 12) {
      setFieldError(t('cardNumber'));
      return false;
    }
    if (!expiry || !/^(0[1-9]|1[0-2])\/(\d{2})$/.test(expiry)) {
      setFieldError(t('expiry'));
      return false;
    }
    if (!cvc || cvc.length < 3) {
      setFieldError(t('cvc'));
      return false;
    }
    setFieldError(null);
    return true;
  }, [email, password, firstName, lastName, cardNumber, expiry, cvc, t, isRememberedUser]);

  useEffect(() => {
    const loadRemembered = async () => {
      try {
        const saved = await AsyncStorage.getItem('user_email');
        if (saved && saved.includes('@')) {
          setRememberedEmail(saved);
          setEmail(saved);
          setIsRememberedUser(true);
        }
      } catch {}
    };
    loadRemembered();
  }, []);

  const openCheckout = useCallback(async (planId: SubscriptionTier) => {
    const targetPlan = plans.find(p => p.id === planId);
    const currentPlan = plans.find(p => p.id === subscription.tier);
    if (planId === 'free' || (targetPlan && currentPlan && targetPlan.price <= currentPlan.price)) {
      try {
        setIsSubscribing(true);
        const ok = await subscribeTo(planId);
        if (ok) {
          Alert.alert(
            t('successTitle'),
            t('successWelcome').replace('{plan}', t(planId + 'Plan')),
            [{ text: t('continue'), onPress: () => router.back() }]
          );
        } else {
          Alert.alert(t('error'), t('failedSubscription'));
        }
      } catch {
        Alert.alert(t('error'), t('failedSubscription'));
      } finally {
        setIsSubscribing(false);
      }
      return;
    }
    setSelectedPlan(planId);
    setCheckoutVisible(true);
  }, [plans, subscribeTo, t, subscription.tier]);

  const handleSubscribe = async (planId: SubscriptionTier) => {
    if (planId === 'free') {
      try {
        setIsSubscribing(true);
        const ok = await subscribeTo('free');
        if (ok) {
          Alert.alert(
            t('successTitle'),
            t('successWelcome').replace('{plan}', t('freePlan')),
            [{ text: t('continue'), onPress: () => router.back() }]
          );
        } else {
          Alert.alert(t('error'), t('failedSubscription'));
        }
      } catch {
        Alert.alert(t('error'), t('failedSubscription'));
      } finally {
        setIsSubscribing(false);
        setSelectedPlan(null);
        setCheckoutVisible(false);
      }
      return;
    }

    if (!validateCheckout()) {
      Alert.alert(t('error'), t('failedSubscription'));
      return;
    }

    setIsSubscribing(true);
    setSelectedPlan(planId);

    try {
      const success = await subscribeTo(planId);
      if (success) {
        try {
          if (email && email.includes('@')) {
            await AsyncStorage.setItem('user_email', email);
            setRememberedEmail(email);
            setIsRememberedUser(true);
          }
        } catch {}
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
      setCheckoutVisible(false);
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
            <Text style={styles.currentPlanName}>{t(currentPlan.id + 'Plan')}</Text>
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
      <Stack.Screen options={{ title: t(subscription.tier + 'Plan') }} />
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
                onPress={() => (subscription.tier === plan.id ? null : openCheckout(plan.id))}
                disabled={isSubscribing || subscription.tier === plan.id}
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
                  <Text style={styles.planName}>{t(plan.id + 'Plan')}</Text>
                  <View style={styles.planPricing}>
                    <Text style={styles.planPrice}>
                      {plan.price === 0 ? t('priceFree') : `${plan.price}`}
                    </Text>
                    {plan.price > 0 && (
                      <Text style={styles.planPeriod}>/{t(plan.period)}</Text>
                    )}
                  </View>
                </LinearGradient>

                <View style={styles.planContent}>
                  <View style={styles.planFeatures}>
                    {getPlanFeatures(plan.id).map((feature, index) => (
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
                    onPress={() => (subscription.tier === plan.id ? null : openCheckout(plan.id))}
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

                  {plan.id === 'ultimate' && (() => {
                    const extras = [t('ultimateFeature8'), t('ultimateFeature9'), t('ultimateFeature10')]
                      .filter((f) => (f ?? '').toString().trim() !== '—');
                    if (extras.length === 0) return null;
                    return (
                      <View style={{ marginTop: 8, gap: 8 }}>
                        {extras.map((f, i) => (
                          <View key={i} style={styles.featureItem}>
                            {getFeatureIcon(f)}
                            <Text style={styles.featureText}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
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
        <Modal visible={checkoutVisible} animationType="fade" transparent>
          <View style={[styles.modalOverlay, { justifyContent: 'flex-start' }]}>
            <View style={[styles.modalContent, { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }]}>
              <Text style={styles.modalTitle}>{t('payment')}</Text>
              <Text style={styles.modalSubtitle}>{t('paymentMethod')}</Text>

              <View style={styles.payRow}>
                <TouchableOpacity style={[styles.payMethodButton, styles.apple, styles.disabledMethod]} disabled>
                  <Text style={styles.payMethodText}>{t('applePay')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.payMethodButton, styles.google, styles.disabledMethod]} disabled>
                  <Text style={styles.payMethodText}>{t('googlePay')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.methodNote}>{t('notAvailableInExpoGo')}</Text>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>{t('creditDebitCard')}</Text>
              {isRememberedUser ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: '#111', fontWeight: '600' }}>{rememberedEmail}</Text>
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>Signed in</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    placeholder={t('email')}
                    placeholderTextColor="#999"
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="email"
                    testID="emailInput"
                  />
                  <TextInput
                    placeholder={t('password')}
                    placeholderTextColor="#999"
                    style={styles.input}
                    autoCapitalize="none"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    testID="passwordInput"
                  />
                </>
              )}
              <View style={styles.row}>
                <TextInput
                  placeholder={t('firstName')}
                  placeholderTextColor="#999"
                  style={[styles.input, styles.inputHalf]}
                  autoCapitalize="words"
                  value={firstName}
                  onChangeText={setFirstName}
                  testID="firstNameInput"
                />
                <TextInput
                  placeholder={t('surname')}
                  placeholderTextColor="#999"
                  style={[styles.input, styles.inputHalf]}
                  autoCapitalize="words"
                  value={lastName}
                  onChangeText={setLastName}
                  testID="lastNameInput"
                />
              </View>
              <TextInput
                placeholder={t('cardNumber')}
                placeholderTextColor="#999"
                style={styles.input}
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                value={cardNumber}
                onChangeText={setCardNumber}
                contextMenuHidden={false}
                autoCorrect={false}
                autoComplete="cc-number"
                testID="cardInput"
              />
              <View style={styles.row}>
                <TextInput
                  placeholder={t('expiry')}
                  placeholderTextColor="#999"
                  style={[styles.input, styles.inputHalf]}
                  keyboardType="numbers-and-punctuation"
                  value={expiry}
                  onChangeText={setExpiry}
                  maxLength={5}
                  testID="expiryInput"
                />
                <TextInput
                  placeholder={t('cvc')}
                  placeholderTextColor="#999"
                  style={[styles.input, styles.inputHalf]}
                  keyboardType="number-pad"
                  value={cvc}
                  onChangeText={setCvc}
                  maxLength={4}
                  testID="cvcInput"
                />
              </View>

              {fieldError ? (
                <Text style={styles.errorText}>{t('error')}: {fieldError}</Text>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => { setCheckoutVisible(false); setSelectedPlan(null); }}
                  style={[styles.actionButton, styles.cancelButton]}
                >
                  <Text style={styles.actionButtonText}>{t('cancelAction')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => selectedPlan ? handleSubscribe(selectedPlan) : null}
                  style={[styles.actionButton, styles.payButton]}
                >
                  {isSubscribing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>{t('payNow')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 12,
  },
  payRow: {
    flexDirection: 'row',
    gap: 12,
  },
  payMethodButton: {
    flex: 1,
    backgroundColor: '#111',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  apple: { backgroundColor: '#000' },
  google: { backgroundColor: '#1a73e8' },
  disabledMethod: { opacity: 0.4 },
  payMethodText: { color: '#fff', fontWeight: '600' },
  methodNote: { color: '#999', fontSize: 12, marginTop: 8 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  row: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },
  errorText: { color: '#e11d48', marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  payButton: { backgroundColor: '#111827' },
  actionButtonText: { color: '#111', fontWeight: '700' },
});