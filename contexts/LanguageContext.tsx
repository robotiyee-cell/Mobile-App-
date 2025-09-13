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
    sarcastic: 'Designer Roast',
    allCategories: 'All Categories',
    
    // Category descriptions
    sexyDesc: 'Bold, alluring, confident',
    elegantDesc: 'Sophisticated, refined, graceful',
    casualDesc: 'Relaxed, comfortable, everyday',
    naiveDesc: 'Sweet, innocent, youthful',
    trendyDesc: 'Fashion-forward, current, stylish',
    animeDesc: 'Kawaii, colorful, playful',
    sixtiesDesc: 'Retro, mod, vintage vibes',
    sarcasticDesc: 'Sarcastic critique in a famed designer tone',
    custom: 'Custom',
    customDesc: 'Define your own style (e.g., "Bohemian", "Y2K", "K-Pop")',
    enterCustomStyle: 'Enter Custom Style',
    customStylePlaceholder: 'e.g., Bohemian, Cottagecore, Y2K, Minimalist',
    startCustomAnalysis: 'Start Custom Analysis',
    allCategoriesDesc: 'Get results for all 7 categories',
    
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
    trendInsights: 'Trend Insights',
    viewTrendInsights: 'View Trend Insights',
    generatingTrends: 'Generating trend insights...',
    emailSupport: 'E-Mail',
    export: 'Export',
    exportAnalysis: 'Export Analysis',
    
    // Buttons
    newPhoto: 'New Photo',
    chooseDifferentPhoto: 'Choose Different Photo',
    changeStyleCategory: 'Change Style Category',
    changeRatingCategory: 'Change Rating Category',
    backToCategories: 'Back to Categories',
    rateNewOutfit: 'Rate New Outfit',
    back: 'Back',
    save: 'Save',

    // Extra action copy
    rateThisOutfit: 'Rate This Outfit',
    chooseCategoryForTargetedAnalysis: 'Choose a category to get a targeted analysis, or select general rating',
    allCategories7Results: 'All Categories (7 Results)',
    categoryBreakdown7: 'Category Breakdown - 7 Separate Results',
    suggestionsFor: 'Suggestions for {category}:',
    noCategoryResults: 'No category results available',
    rateThisOutfitDifferentCategory: 'Rate this same outfit with a different style category',
    chooseDifferentStyleCategory: 'Choose Different Style Category',
    clearHistory: 'Clear History',

    // History
    yourRatingHistory: 'Your Rating History',
    historySubtitle: 'Your last {count} outfit ratings with privacy protection',
    noRatingsYet: 'No ratings yet',
    noRatingsSubtext: 'Upload your first outfit to get started!',
    clearHistoryTitle: 'Clear History',
    clearHistoryConfirm: 'This will delete all saved ratings. Are you sure?',
    cancel: 'Cancel',
    clear: 'Clear',
    cleared: 'Cleared',
    historyCleared: 'Your rating history was cleared.',
    couldNotClearHistory: 'Could not clear history. Please try again.',

    // Terms
    termsTitle: 'Terms and Conditions',
    copyrightNoticeTitle: 'Copyright Notice',
    copyrightNotice: 'Copyright (©) 2024 Look4Fun. All rights reserved. Unauthorized copying or distribution is prohibited.',
    termsOfUseTitle: 'Terms of Use',
    termsIntro: 'By using this application ("L4F"), you agree to the following terms and conditions:',
    copyrightProtectionTitle: '1. Copyright Protection',
    copyrightProtectionText: 'This application and all its contents, including but not limited to design, code, graphics, text, and functionality, are protected by copyright law and owned by Look4Fun.',
    prohibitedActivitiesTitle: '2. Prohibited Activities',
    prohibitedActivitiesBullets: 'You are strictly prohibited from:\n• Copying, reproducing, or distributing any part of this application\n• Reverse engineering or attempting to extract source code\n• Creating derivative works based on this application\n• Using this application for commercial purposes without permission\n• Removing or modifying copyright notices',
    privacyAndDataTitle: '3. Privacy and Data',
    privacyAndDataText: 'Your privacy is important to us. Face masking technology is used to protect your identity during AI analysis. Only outfit data is processed, ensuring your personal information remains secure.',
    intellectualPropertyTitle: '4. Intellectual Property',
    intellectualPropertyText: 'All intellectual property rights in this application remain with Look4Fun. No rights are granted to users except for personal, non-commercial use as outlined in these terms.',
    violationsTitle: '5. Violations',
    violationsText: 'Any violation of these terms may result in immediate termination of your access to the application and potential legal action.',
    contactTitle: '6. Contact',
    contactText: 'For permissions, licensing inquiries, or questions about these terms, contact: Look4Fun',
    acceptTermsLabel: 'I Accept the Terms and Conditions',
    continueToApp: 'Continue to App',

    // Subscription
    freePlan: 'Free Plan',
    basicPlan: 'Basic Plan',
    premiumPlan: 'Premium Plan',
    ultimatePlan: 'Ultimate Plan',
    upgrade: 'Upgrade',
    manage: 'Manage',
    month: 'month',
    year: 'year',
    analysesRemaining: '{count} analyses remaining today',
    unlimitedAnalyses: 'Unlimited analyses remaining',
    premiumFeatureTitle: 'Premium Feature',
    premiumAllMessage: 'The "All Categories" analysis is available for Premium and Ultimate subscribers only. Upgrade now to analyze your outfit across all 7 style categories!',
    premiumFeatureUnlock: 'Premium Feature - Upgrade to unlock',
    currentPlan: 'Current Plan',
    expires: 'Expires:',
    upgradeToPremiumHeader: 'Upgrade to L4F Premium',
    upgradeToPremiumSub: 'Unlock unlimited style analysis and premium features',
    chooseYourPlan: 'Choose Your Plan',
    chooseYourPlanSub: 'Select the perfect plan for your style journey',
    mostPopular: 'MOST POPULAR',
    priceFree: 'Free',
    currentPlanCta: 'Current Plan',
    downgrade: 'Downgrade',
    subscribe: 'Subscribe',
    loadingPlans: 'Loading subscription plans...',

    // Checkout / Payments
    payment: 'Payment',
    paymentMethod: 'Payment Method',
    email: 'Email',
    password: 'Password',
    firstName: 'First Name',
    surname: 'Surname',
    cardNumber: 'Card Number',
    expiry: 'Expiry (MM/YY)',
    cvc: 'CVC',
    payNow: 'Pay Now',
    continue: 'Continue',
    applePay: 'Apple Pay',
    googlePay: 'Google Pay',
    creditDebitCard: 'Credit/Debit Card',
    cancelAction: 'Cancel',
    notAvailableOnWeb: 'Not available on web preview',
    notAvailableInExpoGo: 'This method requires a store build and is not available in Expo Go. Use card as a demo.',
    enableTestMode: 'Enable Test Mode',
    testModeActive: 'Test Mode (No Card Required)',
    testModeWarning: 'Test mode enabled - No payment required for testing',

    // Plan Feature texts
    freeFeature1: '3 outfit analyses per day',
    freeFeature2: 'Basic style categories',
    freeFeature3: 'Limited history (5 items)',
    freeFeature4: 'Standard support',
    freeFeature5: '—',
    freeFeature6: '—',

    basicFeature1: '15 outfit analyses per day',
    basicFeature2: 'Basic style categories',
    basicFeature3: 'Extended history (25 items)',
    basicFeature4: 'Standard support',
    basicFeature5: '\u2014',

    premiumFeature1: 'Unlimited outfit analyses',
    premiumFeature2: 'All categories (7 results)',
    premiumFeature3: 'Unlimited history',
    premiumFeature4: 'Detailed improvement suggestions',
    premiumFeature5: 'Email support',
    premiumFeature6: 'Export analysis results',
    premiumFeature7: '—',

    ultimateFeature1: 'Everything in Premium',
    ultimateFeature2: 'Advanced AI Analysis',
    ultimateFeature3: 'Priority support',
    ultimateFeature4: 'Style trend insights',
    ultimateFeature5: 'Early access to new features',
    ultimateFeature6: '—',
    ultimateFeature7: '—',
    ultimateFeature8: '—',
    ultimateFeature9: '—',
    ultimateFeature10: '—',
    whyPremium: 'Why Choose L4F Premium?',
    benefitAdvancedAI: 'Advanced AI Analysis',
    benefitAdvancedAIDesc: 'Get detailed insights with our most sophisticated AI models',
    benefitUnlimited: 'Unlimited Analyses',
    benefitUnlimitedDesc: 'Analyze as many outfits as you want, whenever you want',
    benefitPrivacy: 'Privacy Protected',
    benefitPrivacyDesc: 'Your photos are always protected with face masking technology',
    benefitGrowth: 'Personal Style Growth',
    benefitGrowthDesc: 'Track your style evolution with unlimited history and insights',
    footerBullets: '• Cancel anytime • No hidden fees • Secure payments',
    footerRenew: 'Subscriptions auto-renew unless cancelled 24 hours before renewal',
    successTitle: 'Success! 🎉',
    successWelcome: 'Welcome to L4F {plan}! Your subscription is now active.',
    startAnalyzing: 'Start Analyzing',
    failedSubscription: 'Failed to process subscription. Please try again.',
    
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
    sarcastic: 'Tasarımcı İğnelemesi',
    allCategories: 'Tüm Kategoriler',
    
    // Category descriptions
    sexyDesc: 'Cesur, çekici, kendinden emin',
    elegantDesc: 'Sofistike, rafine, zarif',
    casualDesc: 'Rahat, konforlu, günlük',
    naiveDesc: 'Tatlı, masum, genç',
    trendyDesc: 'Moda öncüsü, güncel, şık',
    animeDesc: 'Kawaii, renkli, eğlenceli',
    sixtiesDesc: 'Retro, mod, vintage',
    sarcasticDesc: 'Ünlü bir tasarımcının alaycı üslubunda eleştiri',
    custom: 'Özel',
    customDesc: 'Kendi stilinizi tanımlayın (örn. "Bohem", "Y2K", "K-Pop")',
    enterCustomStyle: 'Özel Stili Girin',
    customStylePlaceholder: 'örn. Bohem, Cottagecore, Y2K, Minimalist',
    startCustomAnalysis: 'Özel Analizi Başlat',
    allCategoriesDesc: '7 kategori için sonuç alın',
    
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
    trendInsights: 'Trend İçgörüleri',
    viewTrendInsights: 'Trend İçgörülerini Görüntüle',
    generatingTrends: 'Trend içgörüleri oluşturuluyor...',
    emailSupport: 'E-Posta',
    export: 'Dışa Aktar',
    exportAnalysis: 'Analizi Dışa Aktar',
    
    // Buttons
    newPhoto: 'Yeni Fotoğraf',
    chooseDifferentPhoto: 'Farklı Fotoğraf Seç',
    changeStyleCategory: 'Stil Kategorisini Değiştir',
    changeRatingCategory: 'Değerlendirme Kategorisini Değiştir',
    backToCategories: 'Kategorilere Dön',
    rateNewOutfit: 'Yeni Kıyafet Değerlendir',
    back: 'Geri',
    save: 'Kaydet',

    // Extra action copy
    rateThisOutfit: 'Bu Kıyafeti Puanla',
    chooseCategoryForTargetedAnalysis: 'Hedefli analiz için bir kategori seçin veya genel puanlamayı seçin',
    allCategories7Results: 'Tüm Kategoriler (7 Sonuç)',
    categoryBreakdown7: 'Kategori Dökümü - 7 Ayrı Sonuç',
    suggestionsFor: '{category} için Öneriler:',
    noCategoryResults: 'Kategori sonuçları mevcut değil',
    rateThisOutfitDifferentCategory: 'Aynı kıyafeti farklı bir stil kategorisiyle değerlendir',
    chooseDifferentStyleCategory: 'Farklı Stil Kategorisi Seç',
    clearHistory: 'Geçmişi Temizle',

    // History
    yourRatingHistory: 'Değerlendirme Geçmişiniz',
    historySubtitle: 'Gizlilik koruması ile son {count} kıyafet değerlendirmeniz',
    noRatingsYet: 'Henüz değerlendirme yok',
    noRatingsSubtext: 'Başlamak için ilk kıyafetinizi yükleyin!',
    clearHistoryTitle: 'Geçmişi Temizle',
    clearHistoryConfirm: 'Bu işlem tüm kayıtlı değerlendirmeleri silecek. Emin misiniz?',
    cancel: 'İptal',
    clear: 'Temizle',
    cleared: 'Temizlendi',
    historyCleared: 'Değerlendirme geçmişiniz temizlendi.',
    couldNotClearHistory: 'Geçmiş temizlenemedi. Lütfen tekrar deneyin.',

    // Terms
    termsTitle: 'Şartlar ve Koşullar',
    copyrightNoticeTitle: 'Telif Hakkı Bildirimi',
    copyrightNotice: 'Telif Hakkı (©) 2024 Look4Fun. Tüm hakları saklıdır. İzinsiz kopyalama veya dağıtım yasaktır.',
    termsOfUseTitle: 'Kullanım Şartları',
    termsIntro: 'Bu uygulamayı ("L4F") kullanarak aşağıdaki şartları ve koşulları kabul etmiş olursunuz:',
    copyrightProtectionTitle: '1. Telif Hakkı Koruması',
    copyrightProtectionText: 'Bu uygulama ve tasarım, kod, grafikler, metin ve işlevsellik dahil ancak bunlarla sınırlı olmamak üzere tüm içerikleri telif hakkı yasaları ile korunmaktadır ve Look4Fun’a aittir.',
    prohibitedActivitiesTitle: '2. Yasaklı Faaliyetler',
    prohibitedActivitiesBullets: 'Kesinlikle yasaktır:\n• Uygulamanın herhangi bir bölümünü kopyalamak, çoğaltmak veya dağıtmak\n• Tersine mühendislik yapmak veya kaynak kodu çıkarmaya çalışmak\n• Bu uygulamaya dayalı türev çalışmalar oluşturmak\n• İzin almadan ticari amaçlarla kullanmak\n• Telif hakkı bildirimlerini kaldırmak veya değiştirmek',
    privacyAndDataTitle: '3. Gizlilik ve Veri',
    privacyAndDataText: 'Gizliliğiniz bizim için önemlidir. AI analizi sırasında kimliğinizi korumak için yüz maskeleme teknolojisi kullanılır. Yalnızca kıyafet verileri işlenir.',
    intellectualPropertyTitle: '4. Fikri Mülkiyet',
    intellectualPropertyText: 'Bu uygulamadaki tüm fikri mülkiyet hakları Look4Fun’a aittir. Bu şartlarda belirtilen kişisel, ticari olmayan kullanım dışında kullanıcıya hak tanınmaz.',
    violationsTitle: '5. İhlaller',
    violationsText: 'Bu şartların ihlali, uygulamaya erişiminizin derhal sonlandırılmasına ve yasal işlemlere yol açabilir.',
    contactTitle: '6. İletişim',
    contactText: 'İzinler, lisans talepleri veya bu şartlarla ilgili sorular için: Look4Fun',
    acceptTermsLabel: 'Şartlar ve Koşulları Kabul Ediyorum',
    continueToApp: 'Uygulamaya Devam Et',

    // Subscription
    freePlan: 'Ücretsiz Plan',
    basicPlan: 'Temel Plan',
    premiumPlan: 'Premium Plan',
    ultimatePlan: 'Ultimate Plan',
    upgrade: 'Yükselt',
    manage: 'Yönet',
    month: 'Ay',
    year: 'Yıl',
    analysesRemaining: 'Bugün {count} analiz hakkınız kaldı',
    unlimitedAnalyses: 'Sınırsız analiz hakkınız var',
    premiumFeatureTitle: 'Premium Özellik',
    premiumAllMessage: '"Tüm Kategoriler" analizi yalnızca Premium ve Ultimate abonelere açıktır. Tüm 7 stil kategorisinde analiz için şimdi yükseltin!',
    premiumFeatureUnlock: 'Premium Özellik - Açmak için yükseltin',
    currentPlan: 'Mevcut Plan',
    expires: 'Bitiş:',
    upgradeToPremiumHeader: 'L4F Premium’a Yükseltin',
    upgradeToPremiumSub: 'Sınırsız stil analizi ve premium özelliklerin kilidini açın',
    chooseYourPlan: 'Planınızı Seçin',
    chooseYourPlanSub: 'Stil yolculuğunuza uygun planı seçin',
    mostPopular: 'EN POPÜLER',
    priceFree: 'Ücretsiz',
    currentPlanCta: 'Mevcut Plan',
    downgrade: 'Düşür',
    subscribe: 'Abone Ol',
    loadingPlans: 'Abonelik planları yükleniyor...',

    // Checkout / Payments
    payment: 'Ödeme',
    paymentMethod: 'Ödeme Yöntemi',
    email: 'E-posta',
    password: 'Şifre',
    firstName: 'Ad',
    surname: 'Soyad',
    cardNumber: 'Kart Numarası',
    expiry: 'Son Kullanma (AA/YY)',
    cvc: 'CVC',
    payNow: 'Şimdi Öde',
    continue: 'Devam Et',
    applePay: 'Apple Pay',
    googlePay: 'Google Pay',
    creditDebitCard: 'Kredi/Banka Kartı',
    cancelAction: 'İptal',
    enableTestMode: 'Test Modunu Etkinleştir',
    testModeActive: 'Test Modu (Kart Gerekmez)',
    testModeWarning: 'Test modu etkinleştirildi - Test için ödeme gerekmez',
    notAvailableOnWeb: 'Web önizlemesinde kullanılamaz',
    notAvailableInExpoGo: 'Bu yöntem mağaza derlemesi gerektirir ve Expo Go’da kullanılamaz. Demo için kartı kullanın.',

    // Plan Feature texts
    freeFeature1: 'Günde 3 kıyafet analizi',
    freeFeature2: 'Temel stil kategorileri',
    freeFeature3: 'Sınırlı geçmiş (5 öğe)',
    freeFeature4: 'Standart destek',
    freeFeature5: '—',
    freeFeature6: '—',

    basicFeature1: 'Günde 15 kıyafet analizi',
    basicFeature2: 'Temel stil kategorileri',
    basicFeature3: 'Genişletilmiş geçmiş (25 öğe)',
    basicFeature4: 'Standart destek',
    basicFeature5: '\u2014',

    premiumFeature1: 'Sınırsız kıyafet analizi',
    premiumFeature2: 'Tüm kategoriler (7 sonuç)',
    premiumFeature3: 'Sınırsız geçmiş',
    premiumFeature4: 'Detaylı iyileştirme önerileri',
    premiumFeature5: 'E-posta desteği',
    premiumFeature6: 'Analiz sonuçlarını dışa aktar',
    premiumFeature7: '—',

    ultimateFeature1: 'Premium’daki her şey',
    ultimateFeature2: 'Gelişmiş AI Analizi',
    ultimateFeature3: 'Öncelikli destek',
    ultimateFeature4: 'Stil trend içgörüleri',
    ultimateFeature5: 'Yeni özelliklere erken erişim',
    ultimateFeature6: '—',
    ultimateFeature7: '—',
    ultimateFeature8: '—',
    ultimateFeature9: '—',
    ultimateFeature10: '—',
    whyPremium: 'Neden L4F Premium?',
    benefitAdvancedAI: 'Gelişmiş AI Analizi',
    benefitAdvancedAIDesc: 'En gelişmiş AI modellerimizle detaylı içgörüler alın',
    benefitUnlimited: 'Sınırsız Analiz',
    benefitUnlimitedDesc: 'İstediğiniz zaman sınırsız sayıda kıyafet analiz edin',
    benefitPrivacy: 'Gizlilik Korumalı',
    benefitPrivacyDesc: 'Fotoğraflarınız yüz maskeleme teknolojisiyle her zaman korunur',
    benefitGrowth: 'Kişisel Stil Gelişimi',
    benefitGrowthDesc: 'Sınırsız geçmiş ve içgörülerle stil evriminizi takip edin',
    footerBullets: '• İstediğiniz zaman iptal • Gizli ücret yok • Güvenli ödemeler',
    footerRenew: 'Abonelikler yenilemeden 24 saat önce iptal edilmezse otomatik yenilenir',
    successTitle: 'Başarılı! 🎉',
    successWelcome: 'L4F {plan}\'a hoş geldiniz! Aboneliğiniz şimdi aktif.',
    startAnalyzing: 'Analize Başla',
    failedSubscription: 'Abonelik işlenemedi. Lütfen tekrar deneyin.',
    
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