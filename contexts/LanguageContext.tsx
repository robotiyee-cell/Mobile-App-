import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export type Language = 'en' | 'tr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  languageLabel: string;
}

const translations = {
  en: {
    // Header
    appName: 'Look4Fun',
    appDescription: 'Look for fun with ai fashion review',
    
    // Settings
    settings: 'Settings',
    language: 'Language',
    selectLanguage: 'Select Language',
    english: 'English',
    turkish: 'Turkish',
    apply: 'Apply',
    changesSaved: 'Changes saved',
    
    // Upload Section
    uploadYourOutfit: 'Upload Your Outfit',
    uploadSubtitle: 'Take a photo or choose from gallery to get your outfit rated',
    takePhoto: 'Take Photo',
    chooseFromGallery: 'Choose from Gallery',
    
    // Privacy
    privacyProtected: 'Privacy Protected',
    privacyMatters: '🔒 Your Privacy Matters',
    privacyExplanation: 'Your face is automatically masked before sending to AI analysis. Only your outfit is analyzed, ensuring your identity remains private.',
    faceProtected: 'Face Protected',
    
    // Categories
    chooseStyleCategory: 'Choose Your Style Category',
    categorySubtitle: 'Select the style you\'re aiming for to get a more targeted analysis',
    sexy: 'Sexy',
    elegant: 'Elegant',
    casual: 'Casual',
    naive: 'Naive',
    trendy: 'Trendy',
    anime: 'Anime',
    sixties: '60\'s',
    allCategories: 'All Categories',
    
    // Category descriptions
    sexyDesc: 'Bold, alluring, confident',
    elegantDesc: 'Sophisticated, refined, graceful',
    casualDesc: 'Relaxed, comfortable, everyday',
    naiveDesc: 'Sweet, innocent, youthful',
    trendyDesc: 'Fashion-forward, current, stylish',
    animeDesc: 'Kawaii, colorful, playful',
    sixtiesDesc: 'Retro, mod, vintage vibes',
    allCategoriesDesc: 'Get results for all 6 categories',
    
    // Analysis
    analyzing: 'Analyzing...',
    rateMyOutfit: 'Rate My Outfit',
    yourStyleScore: 'Your Style Score',
    overallStyleScore: 'Overall Style Score',
    selectedStyle: 'Selected Style:',
    analyzedForStyle: 'Analyzed for Style:',
    analysisType: 'Analysis Type:',
    
    // Analysis sections
    styleAnalysis: 'Style Analysis',
    colorCoordination: 'Color Coordination',
    accessories: 'Accessories',
    overallHarmony: 'Overall Harmony',
    overallAnalysis: 'Overall Analysis',
    categoryBreakdown: 'Category Breakdown',
    improvementSuggestions: 'Improvement Suggestions',
    
    // Buttons
    newPhoto: 'New Photo',
    chooseDifferentPhoto: 'Choose Different Photo',
    changeStyleCategory: 'Change Style Category',
    changeRatingCategory: 'Change Rating Category',
    backToCategories: 'Back to Categories',
    rateNewOutfit: 'Rate New Outfit',
    
    // History
    yourRatingHistory: 'Your Rating History',
    historySubtitle: 'Your last {count} outfit ratings with privacy protection',
    noRatingsYet: 'No ratings yet',
    noRatingsSubtext: 'Upload your first outfit to get started!',
    
    // Subscription
    freePlan: 'Free Plan',
    premiumPlan: 'Premium Plan',
    ultimatePlan: 'Ultimate Plan',
    upgrade: 'Upgrade',
    manage: 'Manage',
    analysesRemaining: '{count} analyses remaining today',
    unlimitedAnalyses: 'Unlimited analyses remaining',
    
    // Errors
    permissionNeeded: 'Permission needed',
    cameraPermissionRequired: 'Camera permission is required to take photos.',
    error: 'Error',
    failedToPickImage: 'Failed to pick image. Please try again.',
    failedToAnalyze: 'Failed to analyze outfit. Please try again.',
    analysisLimitReached: 'Analysis Limit Reached',
    analysisLimitMessage: 'You\'ve reached your daily limit of {limit} analyses. Upgrade to Premium for unlimited analyses!',
    maybeLater: 'Maybe Later',
    upgradeNow: 'Upgrade Now',
  },
  tr: {
    // Header
    appName: 'Look4Fun',
    appDescription: 'AI moda değerlendirmesi ile eğlenceli görünün',
    
    // Settings
    settings: 'Ayarlar',
    language: 'Dil',
    selectLanguage: 'Dil Seçin',
    english: 'İngilizce',
    turkish: 'Türkçe',
    apply: 'Uygula',
    changesSaved: 'Değişiklikler kaydedildi',
    
    // Upload Section
    uploadYourOutfit: 'Kıyafetinizi Yükleyin',
    uploadSubtitle: 'Fotoğraf çekin veya galeriden seçin ve kıyafetinizi değerlendirin',
    takePhoto: 'Fotoğraf Çek',
    chooseFromGallery: 'Galeriden Seç',
    
    // Privacy
    privacyProtected: 'Gizlilik Korumalı',
    privacyMatters: '🔒 Gizliliğiniz Önemli',
    privacyExplanation: 'Yüzünüz AI analizine gönderilmeden önce otomatik olarak maskelenir. Sadece kıyafetiniz analiz edilir, kimliğiniz gizli kalır.',
    faceProtected: 'Yüz Korumalı',
    
    // Categories
    chooseStyleCategory: 'Stil Kategorinizi Seçin',
    categorySubtitle: 'Hedeflediğiniz stili seçin ve daha hedefli bir analiz alın',
    sexy: 'Seksi',
    elegant: 'Zarif',
    casual: 'Günlük',
    naive: 'Masum',
    trendy: 'Trendy',
    anime: 'Anime',
    sixties: '60\'lar',
    allCategories: 'Tüm Kategoriler',
    
    // Category descriptions
    sexyDesc: 'Cesur, çekici, kendinden emin',
    elegantDesc: 'Sofistike, rafine, zarif',
    casualDesc: 'Rahat, konforlu, günlük',
    naiveDesc: 'Tatlı, masum, genç',
    trendyDesc: 'Moda öncüsü, güncel, şık',
    animeDesc: 'Kawaii, renkli, eğlenceli',
    sixtiesDesc: 'Retro, mod, vintage',
    allCategoriesDesc: '6 kategori için sonuç alın',
    
    // Analysis
    analyzing: 'Analiz ediliyor...',
    rateMyOutfit: 'Kıyafetimi Değerlendir',
    yourStyleScore: 'Stil Puanınız',
    overallStyleScore: 'Genel Stil Puanı',
    selectedStyle: 'Seçilen Stil:',
    analyzedForStyle: 'Analiz Edilen Stil:',
    analysisType: 'Analiz Türü:',
    
    // Analysis sections
    styleAnalysis: 'Stil Analizi',
    colorCoordination: 'Renk Koordinasyonu',
    accessories: 'Aksesuarlar',
    overallHarmony: 'Genel Uyum',
    overallAnalysis: 'Genel Analiz',
    categoryBreakdown: 'Kategori Dökümü',
    improvementSuggestions: 'İyileştirme Önerileri',
    
    // Buttons
    newPhoto: 'Yeni Fotoğraf',
    chooseDifferentPhoto: 'Farklı Fotoğraf Seç',
    changeStyleCategory: 'Stil Kategorisini Değiştir',
    changeRatingCategory: 'Değerlendirme Kategorisini Değiştir',
    backToCategories: 'Kategorilere Dön',
    rateNewOutfit: 'Yeni Kıyafet Değerlendir',
    
    // History
    yourRatingHistory: 'Değerlendirme Geçmişiniz',
    historySubtitle: 'Gizlilik koruması ile son {count} kıyafet değerlendirmeniz',
    noRatingsYet: 'Henüz değerlendirme yok',
    noRatingsSubtext: 'Başlamak için ilk kıyafetinizi yükleyin!',
    
    // Subscription
    freePlan: 'Ücretsiz Plan',
    premiumPlan: 'Premium Plan',
    ultimatePlan: 'Ultimate Plan',
    upgrade: 'Yükselt',
    manage: 'Yönet',
    analysesRemaining: 'Bugün {count} analiz hakkınız kaldı',
    unlimitedAnalyses: 'Sınırsız analiz hakkınız var',
    
    // Errors
    permissionNeeded: 'İzin gerekli',
    cameraPermissionRequired: 'Fotoğraf çekmek için kamera izni gereklidir.',
    error: 'Hata',
    failedToPickImage: 'Resim seçilemedi. Lütfen tekrar deneyin.',
    failedToAnalyze: 'Kıyafet analiz edilemedi. Lütfen tekrar deneyin.',
    analysisLimitReached: 'Analiz Limitine Ulaşıldı',
    analysisLimitMessage: 'Günlük {limit} analiz limitinize ulaştınız. Sınırsız analiz için Premium\'a yükseltin!',
    maybeLater: 'Belki Sonra',
    upgradeNow: 'Şimdi Yükselt',
  },
};

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'tr')) {
        setLanguageState(savedLanguage as Language);
      }
    } catch (error) {
      console.log('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('app_language', lang);
      setLanguageState(lang);
    } catch (error) {
      console.log('Error saving language:', error);
    }
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  const languageLabel = language === 'tr' ? 'Türkçe' : 'English';

  return {
    language,
    setLanguage,
    t,
    languageLabel,
  };
});