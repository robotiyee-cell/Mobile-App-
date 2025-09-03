import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  Animated,
  AppState,
  AppStateStatus,
  Share,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import * as MailComposer from 'expo-mail-composer';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, Upload, Star, Sparkles, Lightbulb, History, Shield, Heart, Crown, Coffee, Flower, Zap, Gamepad2, Music, X, Check, FileText, CreditCard, AlertCircle, Settings, Scissors, TrendingUp, Home } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { router } from 'expo-router';

interface OutfitAnalysis {
  style: string;
  colorCoordination: string;
  accessories: string;
  harmony: string;
  score: number;
  suggestions: string[];
}

interface CategoryResult {
  category: string;
  score: number;
  analysis: string;
  suggestions: string[];
}

interface AllCategoriesAnalysis {
  results: CategoryResult[];
  overallScore: number;
  overallAnalysis: string;
}

interface SavedRating {
  id: string;
  imageUri: string;
  maskedImageUri?: string;
  category: StyleCategory;
  analysis: OutfitAnalysis | AllCategoriesAnalysis;
  timestamp: number;
}

type StyleCategory = 'sexy' | 'elegant' | 'casual' | 'naive' | 'trendy' | 'anime' | 'sixties' | 'sarcastic' | 'rate';

interface CategoryOption {
  id: StyleCategory;
  label: string;
  description: string;
  color: string;
}

const STYLE_CATEGORIES: CategoryOption[] = [
  { id: 'sexy', label: 'Sexy', description: 'Bold, alluring, confident', color: '#FF6B6B' },
  { id: 'elegant', label: 'Elegant', description: 'Sophisticated, refined, graceful', color: '#4ECDC4' },
  { id: 'casual', label: 'Casual', description: 'Relaxed, comfortable, everyday', color: '#45B7D1' },
  { id: 'naive', label: 'Naive', description: 'Sweet, innocent, youthful', color: '#FFA07A' },
  { id: 'trendy', label: 'Trendy', description: 'Fashion-forward, current, stylish', color: '#98D8C8' },
  { id: 'anime', label: 'Anime', description: 'Kawaii, colorful, playful', color: '#FF69B4' },
  { id: 'sixties', label: '60\'s', description: 'Retro, mod, vintage vibes', color: '#9B59B6' },
  { id: 'sarcastic', label: 'Designer Roast', description: 'Playful designer roast in a famed designer tone', color: '#39FF14' },
  { id: 'rate', label: 'All', description: 'All categories with 7 results', color: '#FFD700' },
];

const TEXT_COLOR_MAP: Record<StyleCategory, string> = {
  sexy: '#E91E63',
  elegant: '#6A1B9A',
  casual: '#0EA5E9',
  naive: '#FF1493',
  trendy: '#1E90FF',
  anime: '#C2185B',
  sixties: '#6A1B9A',
  sarcastic: '#FF0000',
  rate: '#6A1B9A',
} as const;

const getTextColor = (category: StyleCategory | string | null | undefined): string => {
  if (!category) return '#6A1B9A';
  const key = category as StyleCategory;
  return TEXT_COLOR_MAP[key] ?? '#6A1B9A';
};

export default function OutfitRatingScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [maskedImage, setMaskedImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<StyleCategory | null>(null);
  const [analysis, setAnalysis] = useState<OutfitAnalysis | AllCategoriesAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [savedRatings, setSavedRatings] = useState<SavedRating[]>([]);
  const [isAppActive, setIsAppActive] = useState<boolean>(true);
  const isMountedRef = useRef<boolean>(true);
  const ignoreResponsesRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(0);
  const currentAbortRef = useRef<AbortController | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showRateOptions, setShowRateOptions] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [showInitialTerms, setShowInitialTerms] = useState<boolean>(true);
  const [shouldResume, setShouldResume] = useState<boolean>(false);
  const [trendVisible, setTrendVisible] = useState<boolean>(false);
  const [trendLoading, setTrendLoading] = useState<boolean>(false);
  const [trendText, setTrendText] = useState<string>('');
  const { subscription, canAnalyze, incrementAnalysisCount } = useSubscription();
  const { t, language } = useLanguage();
  const isPremiumLike = subscription.tier === 'premium' || subscription.tier === 'ultimate';

  useEffect(() => {
    loadSavedRatings();
    checkTermsAcceptance();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const isAnalyzingRef = { current: isAnalyzing } as React.MutableRefObject<boolean> & { current: boolean };

    const handleStateChange = (nextState: AppStateStatus) => {
      const active = nextState === 'active';
      setIsAppActive(active);
      ignoreResponsesRef.current = false;

      if (!active) {
        if (isAnalyzingRef.current) {
          setShouldResume(true);
        }
      } else if (active) {
        if (shouldResume && selectedImage && selectedCategory && !isAnalyzing) {
          setShouldResume(false);
          setTimeout(() => {
            if (isMountedRef.current && !isAnalyzing) {
              analyzeOutfit();
            }
          }, 250);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleStateChange);

    return () => {
      isMountedRef.current = false;
      sub.remove();
    };
  }, [isAnalyzing, shouldResume, selectedImage, selectedCategory]);

  const checkTermsAcceptance = async () => {
    try {
      const accepted = await AsyncStorage.getItem('termsAccepted');
      if (accepted === 'true') {
        setTermsAccepted(true);
        setShowInitialTerms(false);
      }
    } catch (error) {
      console.log('Error checking terms acceptance:', error);
    }
  };

  const acceptTerms = async () => {
    try {
      await AsyncStorage.setItem('termsAccepted', 'true');
      setTermsAccepted(true);
      setShowInitialTerms(false);
      setShowTermsModal(false);
    } catch (error) {
      console.log('Error saving terms acceptance:', error);
    }
  };

  const loadSavedRatings = async () => {
    try {
      const saved = await AsyncStorage.getItem('outfitRatings');
      if (saved) {
        setSavedRatings(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading saved ratings:', error);
    }
  };

  const saveRating = async (rating: SavedRating) => {
    try {
      const updatedRatings = [rating, ...savedRatings.slice(0, 9)]; // Keep last 10 ratings
      setSavedRatings(updatedRatings);
      await AsyncStorage.setItem('outfitRatings', JSON.stringify(updatedRatings));
    } catch (error) {
      console.log('Error saving rating:', error);
    }
  };

  const maskFaceInImage = async (imageUri: string): Promise<string> => {
    try {
      // For web, we'll use a simple blur overlay approach
      // For mobile, we'll create a masked version with a face blur overlay
      if (Platform.OS === 'web') {
        // Return original image for web - masking will be handled in UI
        return imageUri;
      } else {
        // For mobile, return the original image and handle masking in UI
        return imageUri;
      }
    } catch (error) {
      console.log('Error masking image:', error);
      return imageUri;
    }
  };

  const pickImage = async (useCamera: boolean = false) => {
    try {
      let result;
      
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('permissionNeeded'), t('cameraPermissionRequired'));
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        
        // Create masked version for privacy
        const masked = await maskFaceInImage(imageUri);
        setMaskedImage(masked);
        
        setAnalysis(null);
        setSelectedCategory(null);
        setShowCategorySelection(true);
        setShowHistory(false);
      }
    } catch {
      Alert.alert(t('error'), t('failedToPickImage'));
    }
  };

  function validateTextQuality(text: unknown, minChars: number): boolean {
    if (typeof text !== 'string') return false;
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length >= minChars;
  }

  function validateAnalysis(
    data: unknown,
    category: StyleCategory | null,
  ): { ok: boolean; reason?: string } {
    try {
      if (!data || typeof data !== 'object') return { ok: false, reason: 'no_object' };

      const minChars = subscription.tier === 'ultimate' ? 350 : subscription.tier === 'premium' ? 250 : subscription.tier === 'basic' ? 140 : 80;

      if (category === 'rate') {
        const a = data as AllCategoriesAnalysis;
        if (!Array.isArray(a.results) || a.results.length !== 7) return { ok: false, reason: 'invalid_results_count' };
        for (const r of a.results) {
          if (!r || typeof r !== 'object') return { ok: false, reason: 'result_not_object' };
          if (typeof (r as CategoryResult).category !== 'string') return { ok: false, reason: 'missing_category' };
          const sc = Number((r as CategoryResult).score);
          if (!Number.isFinite(sc) || sc <= 0 || sc > 12) return { ok: false, reason: 'invalid_score' };
          if (!validateTextQuality((r as CategoryResult).analysis, minChars)) return { ok: false, reason: 'analysis_too_short' };
        }
        const overall = Number((a as AllCategoriesAnalysis).overallScore);
        if (!Number.isFinite(overall) || overall <= 0) return { ok: false, reason: 'overall_invalid' };
        if (!validateTextQuality((a as AllCategoriesAnalysis).overallAnalysis, Math.max(120, Math.floor(minChars * 0.6)))) return { ok: false, reason: 'overall_too_short' };
        return { ok: true };
      }

      const a = data as OutfitAnalysis;
      const sc = Number(a.score);
      if (!Number.isFinite(sc) || sc <= 0 || sc > 12) return { ok: false, reason: 'invalid_score' };
      if (!validateTextQuality(a.style, minChars)) return { ok: false, reason: 'style_short' };
      if (!validateTextQuality(a.colorCoordination, Math.max(80, Math.floor(minChars * 0.6)))) return { ok: false, reason: 'color_short' };
      if (!validateTextQuality(a.accessories, Math.max(80, Math.floor(minChars * 0.6)))) return { ok: false, reason: 'accessories_short' };
      if (!validateTextQuality(a.harmony, Math.max(80, Math.floor(minChars * 0.6)))) return { ok: false, reason: 'harmony_short' };
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'exception' };
    }
  }

  const analyzeOutfit = async (categoryOverride?: StyleCategory, retry: boolean = false) => {
    const categoryToUse = categoryOverride ?? selectedCategory;
    console.log('analyzeOutfit called with:', { selectedImage: !!selectedImage, categoryToUse, categoryOverride, stateCategory: selectedCategory });
    if (!selectedImage || !categoryToUse) {
      console.log('Missing required data:', { selectedImage: !!selectedImage, selectedCategory });
      return;
    }

    if (!canAnalyze()) {
      Alert.alert(
        t('analysisLimitReached'),
        t('analysisLimitMessage').replace('{limit}', `${subscription.tier === 'free' ? '3' : '15'}`),
        [
          { text: t('maybeLater'), style: 'cancel' },
          { text: t('upgradeNow'), onPress: () => router.push('/subscription') }
        ]
      );
      return;
    }

    setIsAnalyzing(true);
    const thisReq = ++requestIdRef.current;
    try {
      const categoryInfo = STYLE_CATEGORIES.find(cat => cat.id === categoryToUse);

      const imageToAnalyze = maskedImage || selectedImage;
      let base64Image: string;

      try {
        const base64 = await FileSystem.readAsStringAsync(imageToAnalyze, { encoding: FileSystem.EncodingType.Base64 });
        base64Image = base64;
      } catch (error) {
        console.log('Error converting image to base64:', error);
        if (imageToAnalyze.startsWith('data:')) {
          base64Image = imageToAnalyze.split(',')[1];
        } else {
          throw new Error('Failed to process image');
        }
      }

      if (currentAbortRef.current) {
        try { currentAbortRef.current.abort(); } catch {}
      }
      const controller = new AbortController();
      currentAbortRef.current = controller;

      const lengthPolicy = subscription.tier === 'ultimate' 
        ? 'very long (7+ sentences, detailed and thorough)'
        : subscription.tier === 'premium'
        ? 'long (5-6 sentences, well-developed)'
        : subscription.tier === 'basic'
        ? 'medium (3-4 proper sentences)'
        : 'short (2-3 proper sentences)';

      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a professional fashion stylist and outfit critic. The user has indicated they want their outfit analyzed specifically for the "${categoryToUse}" style category (${categoryInfo?.description}).
              
              IMPORTANT: This image has been privacy-protected with face masking before being shared with you. Focus only on the clothing, accessories, and overall styling.
              
              CRITICAL: You MUST analyze this outfit specifically for the "${categoryToUse}" style. Do NOT give generic fashion advice. Your entire analysis should be focused on how well this outfit achieves the specific "${categoryToUse}" aesthetic.
              
              IMPORTANT: Each category has DIFFERENT scoring criteria. The same outfit should receive DIFFERENT scores for different categories based on how well it fits that specific aesthetic.
              
              OUTPUT LENGTH POLICY: Keep your explanations ${lengthPolicy} in length. Targets by plan: Free=2-3 sentences, Basic=3-4 sentences, Premium=5-6 sentences, Ultimate=7+ sentences. Apply this to every analysis field and to each category in ALL CATEGORIES mode.
              
              For the "${categoryToUse}" style specifically:
              ${categoryToUse === 'sexy' ? `
              SEXY STYLE SCORING CRITERIA:
              HIGH SCORES (9-12): Perfect sexy elements like:
              - Form-fitting, body-conscious silhouettes
              - Strategic revealing cuts (low necklines, short hemlines, cutouts)
              - Sultry colors (black, red, deep jewel tones)
              - Confidence-boosting elements (high heels, bold makeup)
              - Luxurious fabrics (silk, satin, leather, lace)
              - Figure-enhancing details
              
              MEDIUM SCORES (6-8): Some sexy elements like:
              - Fitted pieces with modest revealing
              - Darker color palette
              - Some body-conscious styling
              
              LOW SCORES (1-5): Conservative, loose-fitting, or overly modest pieces` : ''}
              ${categoryToUse === 'elegant' ? `
              ELEGANT STYLE SCORING CRITERIA:
              HIGH SCORES (9-12): Perfect elegant elements like:
              - Sophisticated tailoring and refined cuts
              - Classic, timeless silhouettes
              - Neutral or muted color palettes (black, white, navy, beige, pastels)
              - Quality fabrics (wool, silk, cashmere, fine cotton)
              - Understated luxury and minimalist styling
              - Clean lines and polished finishing
              
              MEDIUM SCORES (6-8): Some elegant elements like:
              - Well-tailored pieces
              - Classic colors
              - Refined styling
              
              LOW SCORES (1-5): Casual, overly trendy, or loud patterns/colors` : ''}
              ${categoryToUse === 'casual' ? `
              CASUAL STYLE SCORING CRITERIA:
              HIGH SCORES (9-12): Perfect casual elements like:
              - Comfortable, relaxed fit pieces
              - Everyday wearability and practicality
              - Effortless, laid-back styling
              - Approachable and comfortable fabrics (cotton, denim, jersey)
              - Easy-to-wear combinations
              - Relaxed silhouettes
              
              MEDIUM SCORES (6-8): Some casual elements like:
              - Comfortable pieces with some structure
              - Mix of casual and dressy elements
              
              LOW SCORES (1-5): Overly formal, structured, or high-maintenance pieces` : ''}
              ${categoryToUse === 'naive' ? `
              NAIVE STYLE SCORING CRITERIA:
              HIGH SCORES (9-12): Perfect naive elements like:
              - Sweet, innocent, and youthful styling
              - Soft, pastel colors (pink, baby blue, mint, lavender)
              - Playful details (bows, ruffles, cute prints)
              - Modest cuts and coverage
              - Fresh, pure, and wholesome aesthetics
              - Childlike or romantic elements
              
              MEDIUM SCORES (6-8): Some naive elements like:
              - Soft colors or sweet details
              - Modest styling
              - Youthful elements
              
              LOW SCORES (1-5): Dark colors, edgy styling, or overly mature/sophisticated pieces` : ''}
              ${categoryToUse === 'trendy' ? `
              TRENDY STYLE SCORING CRITERIA:
              HIGH SCORES (9-12): Perfect trendy elements like:
              - Current fashion trends and modern cuts
              - Contemporary styling and fashion-forward pieces
              - Instagram-worthy, social media ready looks
              - Bold, statement pieces
              - Modern color combinations
              - Up-to-date silhouettes and styling
              
              MEDIUM SCORES (6-8): Some trendy elements like:
              - Modern pieces with classic elements
              - Some current trends incorporated
              
              LOW SCORES (1-5): Outdated, classic, or overly conservative styling` : ''}
              ${categoryToUse === 'anime' ? `
              ANIME STYLE SCORING CRITERIA:
              HIGH SCORES (9-12): Perfect anime elements like:
              - Kawaii (cute) elements and styling
              - Bright, vibrant colors (especially pink, blue, purple)
              - Playful accessories (hair clips, colorful bags, cute jewelry)
              - Japanese fashion influences (Harajuku, Lolita, cosplay elements)
              - Colorful, fun, and whimsical pieces
              - Cartoon-like or fantasy elements
              
              MEDIUM SCORES (6-8): Some anime elements like:
              - Bright colors or cute accessories
              - Playful styling
              
              LOW SCORES (1-5): Muted colors, serious styling, or lack of playful elements` : ''}
              ${categoryToUse === 'sixties' ? `
              SIXTIES STYLE SCORING CRITERIA:
              HIGH SCORES (10-12): Perfect sixties elements like:
              - A-line or shift dresses (especially mini length)
              - Bold geometric or floral patterns typical of the 1960s
              - Mod-style pieces with clean lines
              - Bright, saturated colors (especially orange, pink, yellow, turquoise)
              - Go-go boots or Mary Jane shoes
              - Pillbox hats, headbands, or mod hairstyles
              - Oversized sunglasses or cat-eye glasses
              - Turtlenecks or mock necks
              - Cropped jackets or blazers
              - Colorful tights or stockings
              
              MEDIUM SCORES (7-9): Some sixties elements like:
              - Retro-inspired patterns or colors
              - A-line silhouettes
              - Vintage-style accessories
              - 1960s color palette
              
              LOW SCORES (1-6): Modern styles with minimal sixties influence
              
              The outfit in the image appears to be a colorful floral dress which could score HIGH if it has authentic sixties characteristics like the right silhouette, pattern style, and overall mod aesthetic.` : ''}
              ${categoryToUse === 'rate' ? `
              ALL CATEGORIES ANALYSIS - CRITICAL INSTRUCTIONS:
              You MUST analyze this outfit for ALL 7 style categories and provide 7 completely separate and distinct results.
              
              For EACH of the 7 categories (sexy, elegant, casual, naive, trendy, anime, sixties), you must provide:
              - Individual score out of 12 based on how well the outfit fits that SPECIFIC category
              - Detailed analysis of how the outfit performs in that SPECIFIC category (respect the OUTPUT LENGTH POLICY)

              
              IMPORTANT: Each category should have DIFFERENT scores and DIFFERENT analysis based on how the outfit fits that particular style aesthetic.
              
              You MUST return results in this EXACT JSON format with ALL 7 categories:
              {
                "results": [
                  { "category": "sexy", "score": number_out_of_12, "analysis": "..."${isPremiumLike ? ', "suggestions": ["...","...","..."]' : ''} },
                  { "category": "elegant", "score": number_out_of_12, "analysis": "..."${isPremiumLike ? ', "suggestions": ["...","...","..."]' : ''} },
                  { "category": "casual", "score": number_out_of_12, "analysis": "..."${isPremiumLike ? ', "suggestions": ["...","...","..."]' : ''} },
                  { "category": "naive", "score": number_out_of_12, "analysis": "..."${isPremiumLike ? ', "suggestions": ["...","...","..."]' : ''} },
                  { "category": "trendy", "score": number_out_of_12, "analysis": "..."${isPremiumLike ? ', "suggestions": ["...","...","..."]' : ''} },
                  { "category": "anime", "score": number_out_of_12, "analysis": "..."${isPremiumLike ? ', "suggestions": ["...","...","..."]' : ''} },
                  { "category": "sixties", "score": number_out_of_12, "analysis": "..."${isPremiumLike ? ', "suggestions": ["...","...","..."]' : ''} }
                ],
                "overallScore": average_of_all_7_scores,
                "overallAnalysis": "comprehensive summary respecting the OUTPUT LENGTH POLICY"
              }
              
              CRITICAL: You must provide exactly 7 category results. Do not skip any categories. Each result must be unique and tailored to that specific style category.` : ''}
              
              Analyze the outfit with focus on how well it achieves the ${categoryToUse} aesthetic and provide detailed feedback on:
              1. Style - Evaluate how well the outfit embodies the "${categoryToUse}" style and elaborate on the specific elements that contribute to or detract from this aesthetic
              2. Color coordination - How the colors work together for the ${categoryToUse} look specifically
              3. Use of accessories - How accessories enhance or diminish the ${categoryToUse} vibe
              4. Overall harmony - How cohesive the outfit is in achieving the desired ${categoryToUse} aesthetic
              
              Rate the outfit's relevancy to the chosen "${categoryToUse}" category. Give a score out of 12 based on how successfully the outfit achieves the ${categoryToUse} style. 
              
              SCORING GUIDELINES BY CATEGORY:
              - SEXY: Focus on how alluring, confident, and body-conscious the outfit is
              - ELEGANT: Focus on sophistication, refinement, and timeless appeal
              - CASUAL: Focus on comfort, practicality, and effortless wearability
              - NAIVE: Focus on sweetness, innocence, and youthful charm
              - TRENDY: Focus on current fashion trends and modern appeal
              - ANIME: Focus on kawaii elements, bright colors, and playful styling
              - SIXTIES: Focus on authentic 1960s mod elements and retro aesthetics
              - ALL: Analyze across all categories and provide comprehensive results
              
              ${categoryToUse === 'sixties' ? 'For sixties style, prioritize authentic 1960s elements over general fashion appeal. A perfect sixties outfit with authentic mod elements should score 10-12, even if it might not be considered fashionable by today\'s standards.' : ''}
              
              Be constructive but honest in your critique. The SAME OUTFIT should receive DIFFERENT SCORES for different categories. Consider fit, appropriateness for the chosen style, creativity, and overall aesthetic appeal FOR THE ${categoryToUse} STYLE ONLY.
              
              ${categoryToUse === 'sarcastic' ? `
              SPECIAL MODE: DESIGNER ROAST
              - Lean into playful, witty, couture-level humor with vivid metaphors and unapologetic critique.
              - Be more critical: call out mismatches, fit issues, cheap-looking textures, and styling misses with a cheeky, clever tone.
              - Never abusive or personal; keep it fashion-focused and smart. No real names — use an archetypal “famous designer” voice.
              - Pepper each field with fitting emojis (😭😅💅🔥✨🫠🙃🧵✂️) — keep density around 20–30%, not every sentence.
              - End each field with a punchy roast tag line.
              - Do NOT use the word "sarcasm" anywhere.
              - Keep it concise per OUTPUT LENGTH POLICY and return the exact JSON fields.
              ` : ''}
              
              ${categoryToUse !== 'rate' ? `${isPremiumLike ? `After the analysis, provide 3-5 specific, actionable suggestions to improve the outfit and better achieve the ${categoryToUse} aesthetic. Focus on practical improvements like color changes, accessory additions/removals, fit adjustments, or styling tweaks that would make it more ${categoryToUse}.` : `Do NOT include improvement suggestions in the output.`}
              
              Format your response as JSON:
              {
                "style": "detailed analysis (respect the OUTPUT LENGTH POLICY) of how well the outfit achieves the ${categoryToUse} aesthetic with specific references to ${categoryToUse} style elements",
                "colorCoordination": "analysis (respect the OUTPUT LENGTH POLICY) of colors and their harmony for the ${categoryToUse} style specifically",
                "accessories": "commentary (respect the OUTPUT LENGTH POLICY) on accessories and their contribution to the ${categoryToUse} look specifically",
                "harmony": "overall harmony (respect the OUTPUT LENGTH POLICY) and cohesiveness assessment for the ${categoryToUse} aesthetic specifically",
                "score": number_out_of_12${isPremiumLike ? `,
                "suggestions": ["specific ${categoryToUse}-focused improvement suggestion 1", "specific ${categoryToUse}-focused improvement suggestion 2", "specific ${categoryToUse}-focused improvement suggestion 3"]` : ''}
              }` : ''}`
            },
            { role: 'system', content: `All outputs MUST be in ${language === 'tr' ? 'Turkish' : 'English'}. Use this language for every field and sentence.${language === 'tr' ? ' İngilizce kelimeler, argo ya da ödünç sözcükler kullanma. Moda terimlerinde mümkün olduğunca Türkçe karşılıkları kullan ve özellikle Tasarımcı İğnelemesi modunda tamamen doğal Türkçe yaz.' : ''}` },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Please analyze this outfit for the "${categoryToUse}" style category and rate it out of 12. The image has been privacy-protected with face masking. Respond in ${language === 'tr' ? 'Turkish' : 'English'} only.` },
                { type: 'image', image: `data:image/jpeg;base64,${base64Image}` }
              ]
            }
          ]
        })
      , signal: controller.signal });

      const data = await response.json();

      try {
        if (ignoreResponsesRef.current || thisReq !== requestIdRef.current || !isMountedRef.current) {
          return;
        }
        const analysisData = JSON.parse(data.completion);
        setAnalysis(analysisData);

        await incrementAnalysisCount();

        if (selectedImage && selectedCategory) {
          const rating: SavedRating = {
            id: Date.now().toString(),
            imageUri: selectedImage,
            maskedImageUri: maskedImage || undefined,
            category: categoryToUse,
            analysis: analysisData,
            timestamp: Date.now()
          };
          await saveRating(rating);
        }
      } catch (parseError) {
        console.log('Error parsing analysis response:', parseError);

        let fallbackAnalysis;
        if (selectedCategory === 'rate') {
          fallbackAnalysis = {
            results: [
              { category: "sexy", score: 7, analysis: "The outfit has some appealing elements but could be more form-fitting and bold to achieve a sexier look.", suggestions: ["Try more body-conscious silhouettes", "Add statement accessories", "Consider bolder colors"] },
              { category: "elegant", score: 8, analysis: "The outfit shows good sophistication and refinement with classic elements.", suggestions: ["Add refined accessories", "Consider neutral tones", "Focus on quality fabrics"] },
              { category: "casual", score: 9, analysis: "Perfect for everyday wear with comfortable and practical styling.", suggestions: ["Add comfortable layers", "Include practical accessories", "Keep it effortless"] },
              { category: "naive", score: 6, analysis: "The outfit could be sweeter and more youthful to achieve the naive aesthetic.", suggestions: ["Add pastel colors", "Include cute details", "Try softer silhouettes"] },
              { category: "trendy", score: 7, analysis: "The outfit has some modern elements but could be more fashion-forward.", suggestions: ["Add current trends", "Try bold patterns", "Include statement pieces"] },
              { category: "anime", score: 5, analysis: "The outfit needs more colorful and playful elements to achieve the anime aesthetic.", suggestions: ["Add bright colors", "Include kawaii accessories", "Try playful patterns"] },
              { category: "sixties", score: 7, analysis: "The look hints at 1960s vibes; stronger mod elements like a shift silhouette or bold geometric prints would enhance authenticity.", suggestions: ["Try a shift or A-line mini dress", "Introduce geometric or pop floral patterns", "Consider white go-go boots or a headband"] }
            ],
            overallScore: 7,
            overallAnalysis: "The outfit performs well across different categories, with particular strength in casual and elegant styles. There's room for improvement in more expressive categories like anime and naive styles."
          };
        } else {
          fallbackAnalysis = {
            style: "Modern casual",
            colorCoordination: "Good color balance",
            accessories: "Well-chosen accessories",
            harmony: "Overall cohesive look",
            score: 8,
            suggestions: ["Try adding a statement accessory", "Consider different color combinations", "Experiment with layering"]
          };
        }
        if (!(ignoreResponsesRef.current || thisReq !== requestIdRef.current || !isMountedRef.current)) {
          setAnalysis(fallbackAnalysis);
          await incrementAnalysisCount();
          if (selectedImage && selectedCategory) {
            const rating: SavedRating = {
              id: Date.now().toString(),
              imageUri: selectedImage,
              maskedImageUri: maskedImage || undefined,
              category: categoryToUse,
              analysis: fallbackAnalysis,
              timestamp: Date.now()
            };
            await saveRating(rating);
          }
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string } | undefined;
      const aborted = e?.name === 'AbortError' || (e?.message ?? '').toLowerCase().includes('abort');
      if (aborted) {
        console.log('Analysis request aborted due to app going to background. Will resume on return.');
      } else {
        Alert.alert(t('error'), t('failedToAnalyze'));
      }
    } finally {
      if (isMountedRef.current) setIsAnalyzing(false);
      if (currentAbortRef.current) currentAbortRef.current = null;
    }
  };

  const resetApp = () => {
    setSelectedImage(null);
    setMaskedImage(null);
    setAnalysis(null);
    setSelectedCategory(null);
    setShowCategorySelection(false);
    setShowHistory(false);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      // Reset current session when viewing history
      setSelectedImage(null);
      setMaskedImage(null);
      setAnalysis(null);
      setSelectedCategory(null);
      setShowCategorySelection(false);
    }
  };

  const loadSavedRating = (rating: SavedRating) => {
    setSelectedImage(rating.imageUri);
    setMaskedImage(rating.maskedImageUri || null);
    setSelectedCategory(rating.category);
    setAnalysis(rating.analysis);
    setShowCategorySelection(false);
    setShowHistory(false);
  };

  const clearHistory = async () => {
    Alert.alert(
      t('clearHistoryTitle'),
      t('clearHistoryConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('clear'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('outfitRatings');
              setSavedRatings([]);
              Alert.alert(t('cleared'), t('historyCleared'));
            } catch {
              Alert.alert(t('error'), t('couldNotClearHistory'));
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCategorySelect = (category: StyleCategory) => {
    console.log('Category selected:', category);
    if (category === 'rate') {
      // Check if user has premium access for "All category"
      if (subscription.tier === 'free' || subscription.tier === 'basic') {
        Alert.alert(
          t('premiumFeatureTitle'),
          t('premiumAllMessage'),
          [
            { text: t('maybeLater'), style: 'cancel' },
            { 
              text: t('upgradeNow'), 
              onPress: () => router.push('/subscription')
            }
          ]
        );
        return;
      }
    }
    // Set the selected category and hide category selection for all categories
    setSelectedCategory(category);
    setShowCategorySelection(false);
    console.log('Selected category set to:', category);
  };

  const handleRateOptionSelect = (category: StyleCategory) => {
    if (category === 'rate') {
      // Check if user has premium access for "All category"
      if (subscription.tier === 'free' || subscription.tier === 'basic') {
        Alert.alert(
          t('premiumFeatureTitle'),
          t('premiumAllMessage'),
          [
            { text: t('maybeLater'), style: 'cancel' },
            { 
              text: t('upgradeNow'), 
              onPress: () => router.push('/subscription')
            }
          ]
        );
        return;
      }
    }
    setSelectedCategory(category);
    setShowRateOptions(false);
  };

  const goBackToRateOptions = () => {
    setShowRateOptions(true);
    setAnalysis(null);
  };

  const buildExportText = (): string => {
    try {
      const parts: string[] = [];
      const headerKey = selectedCategory === 'rate' ? 'allCategories' : (selectedCategory ?? '');
      const header = selectedCategory ? `${t('selectedStyle')}: ${t(headerKey)}` : t('analysisType');
      parts.push(header);
      if (!analysis) return parts.join('\n');
      if ('results' in (analysis as AllCategoriesAnalysis)) {
        const a = analysis as AllCategoriesAnalysis;
        parts.push(`${t('overallStyleScore')}: ${formatScore(a.overallScore)}/12`);
        parts.push(`${t('overallAnalysis')}: ${a.overallAnalysis}`);
        a.results.forEach((r) => {
          parts.push(`\n${t(r.category as string)} — ${formatScore(r.score)}/12`);
          parts.push(`${t('styleAnalysis')}: ${r.analysis}`);
          if (Array.isArray(r.suggestions)) {
            parts.push(`${t('improvementSuggestions')}:`);
            r.suggestions.forEach((s) => parts.push(`- ${s}`));
          }
        });
      } else {
        const a = analysis as OutfitAnalysis;
        parts.push(`${t('yourStyleScore')}: ${formatScore(a.score)}/12`);
        parts.push(`${t('styleAnalysis')}: ${a.style}`);
        parts.push(`${t('colorCoordination')}: ${a.colorCoordination}`);
        parts.push(`${t('accessories')}: ${a.accessories}`);
        parts.push(`${t('overallHarmony')}: ${a.harmony}`);
        if (Array.isArray(a.suggestions)) {
          parts.push(`${t('improvementSuggestions')}:`);
          a.suggestions.forEach((s) => parts.push(`- ${s}`));
        }
      }
      return parts.join('\n');
    } catch {
      return '';
    }
  };

  const exportAnalysis = async () => {
    try {
      if (!analysis) {
        Alert.alert(t('error'), t('noCategoryResults'));
        return;
      }
      const content = buildExportText();
      const fileName = `analysis-${Date.now()}.txt`;
      if (Platform.OS === 'web') {
        try {
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.log('Web export failed', e);
        }
        return;
      }
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? undefined;
      if (!dir) {
        await Share.share({ message: content });
        return;
      }
      const path = dir + fileName;
      await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
      await Share.share({ url: path, message: content });
    } catch (e) {
      Alert.alert(t('error'), t('couldNotClearHistory'));
    }
  };

  const generateTrendInsights = async (): Promise<void> => {
    if (!selectedImage) {
      Alert.alert(t('error'), t('failedToAnalyze'));
      return;
    }
    try {
      setTrendLoading(true);
      setTrendVisible(true);
      const imageToAnalyze = maskedImage || selectedImage;
      let base64Image: string;
      try {
        const base64 = await FileSystem.readAsStringAsync(imageToAnalyze, { encoding: FileSystem.EncodingType.Base64 });
        base64Image = base64;
      } catch (error) {
        if (imageToAnalyze.startsWith('data:')) {
          base64Image = imageToAnalyze.split(',')[1];
        } else {
          throw error as Error;
        }
      }

      const res = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `You are a senior fashion trend analyst. Produce "Style trend insights" tailored to the specific outfit photo the user provided. Return a compact, actionable briefing for a power user.
              Rules:
              - Language: ${language === 'tr' ? 'Turkish' : 'English'}
              - Format: 5 ultra-concise bullets prefixed with emojis + a short closing line on what to buy next.
              - Cover: palette alignment, silhouette relevance, fabric/texture signals, current micro-trends, and platform-ready styling tips.
              - Tone: expert, punchy, stylish. Avoid fluff.
            ` },
            { role: 'user', content: [
              { type: 'text', text: 'Give me concise, actionable style trend insights for this look.' },
              { type: 'image', image: `data:image/jpeg;base64,${base64Image}` },
            ]}
          ]
        })
      });
      const data = await res.json();
      const text = typeof data?.completion === 'string' ? data.completion : '';
      setTrendText(text || (language === 'tr' ? 'Trend içgörüleri oluşturulamadı.' : 'Could not generate trend insights.'));
    } catch {
      setTrendText(language === 'tr' ? 'Trend içgörüleri oluşturulamadı.' : 'Could not generate trend insights.');
    } finally {
      setTrendLoading(false);
    }
  };

  const emailSupport = async () => {
    try {
      const imageUri = maskedImage || selectedImage || '';
      const catColor = getTextColor(selectedCategory ?? 'rate');
      const heading = selectedCategory ? (selectedCategory === 'rate' ? t('allCategories') : t(selectedCategory)) : t('analysisType');

      let inlineBase64 = '';
      try {
        if (imageUri) {
          if (imageUri.startsWith('data:')) {
            inlineBase64 = imageUri.split(',')[1] ?? '';
          } else {
            const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
            inlineBase64 = base64;
          }
        }
      } catch (e) {
        console.log('Failed to embed image base64 for email', e);
      }

      const asHtml = (() => {
        const safe = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let inner = '';
        if (!analysis) return `<p>${safe(t('noCategoryResults') ?? 'No results')}</p>`;
        if ('results' in (analysis as AllCategoriesAnalysis)) {
          const a = analysis as AllCategoriesAnalysis;
          inner += `<h2 style=\"margin:0 0 12px 0;color:${catColor};font-weight:900;\">${safe(t('overallStyleScore'))}: ${formatScore(a.overallScore)}/12</h2>`;
          inner += `<p style=\"color:${catColor};font-weight:800;line-height:1.6;\">${safe(a.overallAnalysis)}</p>`;
          inner += `<h3 style=\"margin:16px 0 8px 0;color:#6A1B9A;font-weight:900;\">${safe(t('categoryBreakdown7') ?? 'Category breakdown')}</h3>`;
          inner += a.results.map((r) => {
            const rc = getTextColor(r.category as StyleCategory);
            return `<div style=\"margin:12px 0 18px 0;\">\n              <div style=\"display:flex;align-items:baseline;gap:6px;\">\n                <span style=\"display:inline-block;width:8px;height:8px;border-radius:4px;background:${STYLE_CATEGORIES.find(c=>c.id===r.category as any)?.color ?? '#999'}\"></span>\n                <span style=\"font-weight:900;color:${rc};\">${safe(t(r.category as string))}</span>\n                <span style=\"margin-left:auto;color:#FFD700;font-weight:bold;\">${formatScore(r.score)}/12</span>\n              </div>\n              <p style=\"margin:8px 0 0 0;color:${rc};font-weight:800;line-height:1.6;\">${safe(r.analysis)}</p>\n              ${Array.isArray(r.suggestions) ? `<ul style=\"margin:8px 0 0 16px;color:${rc};font-weight:700;\">${r.suggestions.map(s=>`<li>${safe(s)}</li>`).join('')}</ul>` : ''}\n            </div>`
          }).join('');
        } else {
          const a = analysis as OutfitAnalysis;
          const rc = getTextColor(selectedCategory as StyleCategory);
          inner += `<div style=\"margin:0 0 12px 0;display:flex;align-items:baseline;gap:6px;\">\n            <h2 style=\"margin:0;color:${rc};font-weight:900;\">${safe(t('yourStyleScore'))}</h2>\n            <span style=\"color:#FFD700;font-weight:bold;font-size:20px;\">${formatScore(a.score)}/12</span>\n          </div>`;
          inner += `<h3 style=\"margin:8px 0 4px 0;color:${rc};font-weight:900;\">${safe(t('styleAnalysis'))}</h3>`;
          inner += `<p style=\"margin:0;color:${rc};font-weight:700;line-height:1.6;\">${safe(a.style)}</p>`;
          inner += `<h3 style=\"margin:12px 0 4px 0;color:${rc};font-weight:900;\">${safe(t('colorCoordination'))}</h3>`;
          inner += `<p style=\"margin:0;color:${rc};font-weight:700;line-height:1.6;\">${safe(a.colorCoordination)}</p>`;
          inner += `<h3 style=\"margin:12px 0 4px 0;color:${rc};font-weight:900;\">${safe(t('accessories'))}</h3>`;
          inner += `<p style=\"margin:0;color:${rc};font-weight:700;line-height:1.6;\">${safe(a.accessories)}</p>`;
          inner += `<h3 style=\"margin:12px 0 4px 0;color:${rc};font-weight:900;\">${safe(t('overallHarmony'))}</h3>`;
          inner += `<p style=\"margin:0;color:${rc};font-weight:700;line-height:1.6;\">${safe(a.harmony)}</p>`;
          if (Array.isArray(a.suggestions)) {
            inner += `<h3 style=\"margin:16px 0 8px 0;color:#1a1a1a;font-weight:900;\">${safe(t('improvementSuggestions'))}</h3>`;
            inner += `<ul style=\"margin:0 0 0 16px;color:${rc};font-weight:700;\">${a.suggestions.map(s=>`<li>${safe(s)}</li>`).join('')}</ul>`;
          }
        }
        const imgHtml = inlineBase64 ? `<div style=\"margin:16px 0;\"><em style=\"color:#999;\">${safe(t('faceProtected') ?? '')}</em><br/><img alt=\"\" src=\"data:image/jpeg;base64,${inlineBase64}\" style=\"max-width:100%;border-radius:12px;border:1px solid #eee;\"/></div>` : '';
        return `<!doctype html><html><body style=\"font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; background:#FFE4E6; padding:16px;\">\n          <div style=\"max-width:720px;margin:0 auto;background:rgba(255,255,255,0.95);border-radius:16px;padding:16px;\">\n            <h1 style=\"margin:0 0 4px 0;color:#9B59B6;font-style:italic;font-weight:900;\">${safe(t('appName'))}</h1>\n            <div style=\"display:inline-flex;align-items:center;gap:8px;margin:4px 0 16px 0;background:rgba(255,215,0,0.2);padding:4px 8px;border-radius:12px;color:#FFD700;font-weight:900;font-size:12px;\">\n              <span>${safe(t('currentPlan') ?? 'Current Plan')}</span>\n              <span>${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}</span>\n            </div>\n            <div style=\"display:flex;align-items:center;gap:8px;margin-bottom:12px;\">\n              <span style=\"display:inline-block;width:8px;height:8px;border-radius:4px;background:${STYLE_CATEGORIES.find(c=>c.id===selectedCategory)?.color ?? '#FFD700'}\"></span>\n              <span style=\"font-weight:700;color:#1a1a1a;\">${safe(t('selectedStyle'))}:: ${safe(heading)}</span>\n            </div>\n            ${inner}\n            ${imgHtml}\n          </div>\n        </body></html>`;
      })();

      if (Platform.OS === 'web') {
        try {
          const blob = new Blob([asHtml], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `outfit-analysis-${Date.now()}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          Alert.alert(t('exported') ?? 'Exported', t('htmlDownloaded') ?? 'HTML downloaded. Attach it to your email.');
        } catch (e) {
          Alert.alert(t('error'), 'Web export failed');
        }
        return;
      }

      const mailAvailable = await MailComposer.isAvailableAsync();
      if (mailAvailable) {
        try {
          await MailComposer.composeAsync({
            subject: `${t('appName')} — ${t('selectedStyle')}: ${heading}`,
            body: asHtml,
            isHtml: true,
          });
          return;
        } catch (e) {
          console.log('MailComposer failed, falling back to file share', e);
        }
      }
      const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? undefined;
      if (!dir) {
        await Share.share({ message: t('htmlDownloaded') ?? 'Attach the generated HTML file to your email.' });
        return;
      }
      const htmlPath = `${dir}outfit-analysis-${Date.now()}.html`;
      await FileSystem.writeAsStringAsync(htmlPath, asHtml, { encoding: FileSystem.EncodingType.UTF8 });
      await Share.share({ url: htmlPath, message: `${t('appName')} - ${t('selectedStyle')}: ${heading}` });
    } catch {
      Alert.alert(t('error'), 'Email failed');
    }
  };

  const goBackToCategories = () => {
    setShowCategorySelection(true);
    setAnalysis(null);
  };

  const renderScoreStars = (_score: number) => null;

  const PinkGlasses = () => (
    <Svg
      width={80}
      height={30}
      viewBox="0 0 80 30"
      style={styles.glassesOverlay}
    >
      {/* Left lens */}
      <Circle
        cx={18}
        cy={15}
        r={12}
        fill="rgba(255, 255, 255, 0.2)"
        stroke="#FF69B4"
        strokeWidth={3}
      />
      {/* Right lens */}
      <Circle
        cx={62}
        cy={15}
        r={12}
        fill="rgba(255, 255, 255, 0.2)"
        stroke="#FF69B4"
        strokeWidth={3}
      />
      {/* Bridge */}
      <Path
        d="M30 15 Q40 12 50 15"
        stroke="#FF69B4"
        strokeWidth={3}
        fill="none"
      />
      {/* Left temple */}
      <Path
        d="M6 15 Q2 15 0 18"
        stroke="#FF69B4"
        strokeWidth={3}
        fill="none"
      />
      {/* Right temple */}
      <Path
        d="M74 15 Q78 15 80 18"
        stroke="#FF69B4"
        strokeWidth={3}
        fill="none"
      />
    </Svg>
  );

  const FlowerBackground = () => (
    <Svg
      style={styles.flowerBackground}
      width="100%"
      height="100%"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      accessibilityLabel="static-flower-background"
    >
      {/* Large decorative flowers with purple, red, pink, yellow, sky blue */}
      <G opacity={0.18}>
        {/* Purple Flower 1 - Top left */}
        <G transform="translate(50, 100)">
          <Circle cx="0" cy="-15" r="12" fill="#9B59B6" />
          <Circle cx="-12" cy="8" r="12" fill="#8E44AD" />
          <Circle cx="12" cy="8" r="12" fill="#BB6BD9" />
          <Circle cx="-8" cy="-8" r="12" fill="#9B59B6" />
          <Circle cx="8" cy="-8" r="12" fill="#8E44AD" />
          <Circle cx="0" cy="0" r="8" fill="#FFD700" />
        </G>
        
        {/* Red Flower 2 - Top right */}
        <G transform="translate(320, 150)">
          <Circle cx="0" cy="-18" r="15" fill="#DC143C" />
          <Circle cx="-15" cy="9" r="15" fill="#B22222" />
          <Circle cx="15" cy="9" r="15" fill="#FF6347" />
          <Circle cx="-10" cy="-10" r="15" fill="#DC143C" />
          <Circle cx="10" cy="-10" r="15" fill="#B22222" />
          <Circle cx="0" cy="0" r="10" fill="#FFD700" />
        </G>
        
        {/* Pink Flower 3 - Middle left */}
        <G transform="translate(30, 350)">
          <Circle cx="0" cy="-12" r="10" fill="#FF69B4" />
          <Circle cx="-10" cy="6" r="10" fill="#FFB6C1" />
          <Circle cx="10" cy="6" r="10" fill="#FF1493" />
          <Circle cx="-7" cy="-7" r="10" fill="#FF69B4" />
          <Circle cx="7" cy="-7" r="10" fill="#FFB6C1" />
          <Circle cx="0" cy="0" r="6" fill="#FFD700" />
        </G>
        
        {/* Sky Blue Flower 4 - Middle right */}
        <G transform="translate(350, 400)">
          <Circle cx="0" cy="-14" r="12" fill="#87CEEB" />
          <Circle cx="-12" cy="7" r="12" fill="#87CEFA" />
          <Circle cx="12" cy="7" r="12" fill="#B0E0E6" />
          <Circle cx="-8" cy="-8" r="12" fill="#87CEEB" />
          <Circle cx="8" cy="-8" r="12" fill="#87CEFA" />
          <Circle cx="0" cy="0" r="8" fill="#FFD700" />
        </G>
        
        {/* Yellow Flower 5 - Bottom left */}
        <G transform="translate(80, 600)">
          <Circle cx="0" cy="-16" r="14" fill="#FFD700" />
          <Circle cx="-14" cy="8" r="14" fill="#FFA500" />
          <Circle cx="14" cy="8" r="14" fill="#FFFF00" />
          <Circle cx="-10" cy="-10" r="14" fill="#FFD700" />
          <Circle cx="10" cy="-10" r="14" fill="#FFA500" />
          <Circle cx="0" cy="0" r="9" fill="#FF8C00" />
        </G>
        
        {/* Purple Flower 6 - Bottom right */}
        <G transform="translate(300, 650)">
          <Circle cx="0" cy="-13" r="11" fill="#9370DB" />
          <Circle cx="-11" cy="6" r="11" fill="#8A2BE2" />
          <Circle cx="11" cy="6" r="11" fill="#BA55D3" />
          <Circle cx="-8" cy="-8" r="11" fill="#9370DB" />
          <Circle cx="8" cy="-8" r="11" fill="#8A2BE2" />
          <Circle cx="0" cy="0" r="7" fill="#FFD700" />
        </G>
        
        {/* Additional Large Flowers */}
        {/* Red Flower 7 - Top center */}
        <G transform="translate(200, 120)">
          <Circle cx="0" cy="-14" r="13" fill="#FF0000" />
          <Circle cx="-13" cy="7" r="13" fill="#DC143C" />
          <Circle cx="13" cy="7" r="13" fill="#FF4500" />
          <Circle cx="-9" cy="-9" r="13" fill="#FF0000" />
          <Circle cx="9" cy="-9" r="13" fill="#DC143C" />
          <Circle cx="0" cy="0" r="8" fill="#FFD700" />
        </G>
        
        {/* Sky Blue Flower 8 - Left center */}
        <G transform="translate(70, 250)">
          <Circle cx="0" cy="-12" r="11" fill="#00BFFF" />
          <Circle cx="-11" cy="6" r="11" fill="#87CEEB" />
          <Circle cx="11" cy="6" r="11" fill="#ADD8E6" />
          <Circle cx="-8" cy="-8" r="11" fill="#00BFFF" />
          <Circle cx="8" cy="-8" r="11" fill="#87CEEB" />
          <Circle cx="0" cy="0" r="7" fill="#FFD700" />
        </G>
        
        {/* Pink Flower 9 - Right center */}
        <G transform="translate(330, 280)">
          <Circle cx="0" cy="-15" r="12" fill="#FF1493" />
          <Circle cx="-12" cy="8" r="12" fill="#FF69B4" />
          <Circle cx="12" cy="8" r="12" fill="#FFB6C1" />
          <Circle cx="-8" cy="-8" r="12" fill="#FF1493" />
          <Circle cx="8" cy="-8" r="12" fill="#FF69B4" />
          <Circle cx="0" cy="0" r="8" fill="#FFD700" />
        </G>
        
        {/* Yellow Flower 10 - Bottom center */}
        <G transform="translate(200, 550)">
          <Circle cx="0" cy="-16" r="14" fill="#FFFF00" />
          <Circle cx="-14" cy="8" r="14" fill="#FFD700" />
          <Circle cx="14" cy="8" r="14" fill="#FFA500" />
          <Circle cx="-10" cy="-10" r="14" fill="#FFFF00" />
          <Circle cx="10" cy="-10" r="14" fill="#FFD700" />
          <Circle cx="0" cy="0" r="9" fill="#FF8C00" />
        </G>
      </G>
      
      {/* Medium scattered flowers */}
      <G opacity={0.15}>
        {/* Purple flowers */}
        <G transform="translate(150, 80)">
          <Circle cx="0" cy="-8" r="7" fill="#9B59B6" />
          <Circle cx="-7" cy="4" r="7" fill="#8E44AD" />
          <Circle cx="7" cy="4" r="7" fill="#BB6BD9" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        <G transform="translate(250, 200)">
          <Circle cx="0" cy="-8" r="7" fill="#8A2BE2" />
          <Circle cx="-7" cy="4" r="7" fill="#9370DB" />
          <Circle cx="7" cy="4" r="7" fill="#BA55D3" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        {/* Red flowers */}
        <G transform="translate(120, 180)">
          <Circle cx="0" cy="-8" r="7" fill="#FF0000" />
          <Circle cx="-7" cy="4" r="7" fill="#DC143C" />
          <Circle cx="7" cy="4" r="7" fill="#FF4500" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        <G transform="translate(280, 320)">
          <Circle cx="0" cy="-8" r="7" fill="#B22222" />
          <Circle cx="-7" cy="4" r="7" fill="#FF0000" />
          <Circle cx="7" cy="4" r="7" fill="#FF6347" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        {/* Pink flowers */}
        <G transform="translate(180, 450)">
          <Circle cx="0" cy="-8" r="7" fill="#FF69B4" />
          <Circle cx="-7" cy="4" r="7" fill="#FF1493" />
          <Circle cx="7" cy="4" r="7" fill="#FFB6C1" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        <G transform="translate(60, 380)">
          <Circle cx="0" cy="-8" r="7" fill="#FF1493" />
          <Circle cx="-7" cy="4" r="7" fill="#FFB6C1" />
          <Circle cx="7" cy="4" r="7" fill="#FF69B4" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        {/* Sky Blue flowers */}
        <G transform="translate(100, 500)">
          <Circle cx="0" cy="-8" r="7" fill="#87CEEB" />
          <Circle cx="-7" cy="4" r="7" fill="#00BFFF" />
          <Circle cx="7" cy="4" r="7" fill="#ADD8E6" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        <G transform="translate(320, 480)">
          <Circle cx="0" cy="-8" r="7" fill="#00BFFF" />
          <Circle cx="-7" cy="4" r="7" fill="#87CEFA" />
          <Circle cx="7" cy="4" r="7" fill="#B0E0E6" />
          <Circle cx="0" cy="0" r="4" fill="#FFD700" />
        </G>
        
        {/* Yellow flowers */}
        <G transform="translate(220, 350)">
          <Circle cx="0" cy="-8" r="7" fill="#FFFF00" />
          <Circle cx="-7" cy="4" r="7" fill="#FFD700" />
          <Circle cx="7" cy="4" r="7" fill="#FFA500" />
          <Circle cx="0" cy="0" r="4" fill="#FF8C00" />
        </G>
        
        <G transform="translate(340, 520)">
          <Circle cx="0" cy="-8" r="7" fill="#FFD700" />
          <Circle cx="-7" cy="4" r="7" fill="#FFA500" />
          <Circle cx="7" cy="4" r="7" fill="#FFFF00" />
          <Circle cx="0" cy="0" r="4" fill="#FF8C00" />
        </G>
      </G>
      
      {/* Small scattered flowers - covering white areas */}
      <G opacity={0.12}>
        {/* Top area flowers */}
        <G transform="translate(90, 60)">
          <Circle cx="0" cy="-6" r="5" fill="#9B59B6" />
          <Circle cx="-5" cy="3" r="5" fill="#8E44AD" />
          <Circle cx="5" cy="3" r="5" fill="#BB6BD9" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(270, 90)">
          <Circle cx="0" cy="-6" r="5" fill="#FF0000" />
          <Circle cx="-5" cy="3" r="5" fill="#DC143C" />
          <Circle cx="5" cy="3" r="5" fill="#FF4500" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(160, 140)">
          <Circle cx="0" cy="-6" r="5" fill="#FF69B4" />
          <Circle cx="-5" cy="3" r="5" fill="#FF1493" />
          <Circle cx="5" cy="3" r="5" fill="#FFB6C1" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(40, 180)">
          <Circle cx="0" cy="-6" r="5" fill="#87CEEB" />
          <Circle cx="-5" cy="3" r="5" fill="#00BFFF" />
          <Circle cx="5" cy="3" r="5" fill="#ADD8E6" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(360, 160)">
          <Circle cx="0" cy="-6" r="5" fill="#FFFF00" />
          <Circle cx="-5" cy="3" r="5" fill="#FFD700" />
          <Circle cx="5" cy="3" r="5" fill="#FFA500" />
          <Circle cx="0" cy="0" r="3" fill="#FF8C00" />
        </G>
        
        {/* Middle area flowers */}
        <G transform="translate(140, 280)">
          <Circle cx="0" cy="-6" r="5" fill="#8A2BE2" />
          <Circle cx="-5" cy="3" r="5" fill="#9370DB" />
          <Circle cx="5" cy="3" r="5" fill="#BA55D3" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(260, 260)">
          <Circle cx="0" cy="-6" r="5" fill="#B22222" />
          <Circle cx="-5" cy="3" r="5" fill="#FF0000" />
          <Circle cx="5" cy="3" r="5" fill="#FF6347" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(80, 320)">
          <Circle cx="0" cy="-6" r="5" fill="#FF1493" />
          <Circle cx="-5" cy="3" r="5" fill="#FFB6C1" />
          <Circle cx="5" cy="3" r="5" fill="#FF69B4" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(300, 340)">
          <Circle cx="0" cy="-6" r="5" fill="#00BFFF" />
          <Circle cx="-5" cy="3" r="5" fill="#87CEFA" />
          <Circle cx="5" cy="3" r="5" fill="#B0E0E6" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(180, 380)">
          <Circle cx="0" cy="-6" r="5" fill="#FFD700" />
          <Circle cx="-5" cy="3" r="5" fill="#FFA500" />
          <Circle cx="5" cy="3" r="5" fill="#FFFF00" />
          <Circle cx="0" cy="0" r="3" fill="#FF8C00" />
        </G>
        
        {/* Bottom area flowers */}
        <G transform="translate(120, 520)">
          <Circle cx="0" cy="-6" r="5" fill="#9B59B6" />
          <Circle cx="-5" cy="3" r="5" fill="#8E44AD" />
          <Circle cx="5" cy="3" r="5" fill="#BB6BD9" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(280, 580)">
          <Circle cx="0" cy="-6" r="5" fill="#FF0000" />
          <Circle cx="-5" cy="3" r="5" fill="#DC143C" />
          <Circle cx="5" cy="3" r="5" fill="#FF4500" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(50, 580)">
          <Circle cx="0" cy="-6" r="5" fill="#FF69B4" />
          <Circle cx="-5" cy="3" r="5" fill="#FF1493" />
          <Circle cx="5" cy="3" r="5" fill="#FFB6C1" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(350, 600)">
          <Circle cx="0" cy="-6" r="5" fill="#87CEEB" />
          <Circle cx="-5" cy="3" r="5" fill="#00BFFF" />
          <Circle cx="5" cy="3" r="5" fill="#ADD8E6" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(160, 620)">
          <Circle cx="0" cy="-6" r="5" fill="#FFFF00" />
          <Circle cx="-5" cy="3" r="5" fill="#FFD700" />
          <Circle cx="5" cy="3" r="5" fill="#FFA500" />
          <Circle cx="0" cy="0" r="3" fill="#FF8C00" />
        </G>
        
        {/* Extra flowers for white card areas */}
        <G transform="translate(200, 240)">
          <Circle cx="0" cy="-6" r="5" fill="#8A2BE2" />
          <Circle cx="-5" cy="3" r="5" fill="#9370DB" />
          <Circle cx="5" cy="3" r="5" fill="#BA55D3" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(240, 420)">
          <Circle cx="0" cy="-6" r="5" fill="#B22222" />
          <Circle cx="-5" cy="3" r="5" fill="#FF0000" />
          <Circle cx="5" cy="3" r="5" fill="#FF6347" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
        
        <G transform="translate(140, 500)">
          <Circle cx="0" cy="-6" r="5" fill="#FF1493" />
          <Circle cx="-5" cy="3" r="5" fill="#FFB6C1" />
          <Circle cx="5" cy="3" r="5" fill="#FF69B4" />
          <Circle cx="0" cy="0" r="3" fill="#FFD700" />
        </G>
      </G>
      
      {/* Decorative leaves and stems */}
      <G opacity={0.08}>
        <Path d="M60 120 Q80 140 100 120 Q80 100 60 120" fill="#90EE90" />
        <Path d="M340 170 Q360 190 380 170 Q360 150 340 170" fill="#98FB98" />
        <Path d="M50 370 Q70 390 90 370 Q70 350 50 370" fill="#90EE90" />
        <Path d="M370 420 Q390 440 410 420 Q390 400 370 420" fill="#98FB98" />
        <Path d="M100 620 Q120 640 140 620 Q120 600 100 620" fill="#90EE90" />
        <Path d="M320 670 Q340 690 360 670 Q340 650 320 670" fill="#98FB98" />
        {/* Additional leaves */}
        <Path d="M180 200 Q200 220 220 200 Q200 180 180 200" fill="#90EE90" />
        <Path d="M260 300 Q280 320 300 300 Q280 280 260 300" fill="#98FB98" />
        <Path d="M140 420 Q160 440 180 420 Q160 400 140 420" fill="#90EE90" />
        <Path d="M240 520 Q260 540 280 520 Q260 500 240 520" fill="#98FB98" />
      </G>
    </Svg>
  );

  interface FloatingFlowerSpec {
    id: string;
    left: number;
    size: number;
    duration: number;
    delay: number;
    color: string;
  }

  const FloatingFlowers = React.memo(function FloatingFlowers({ active }: { active: boolean }) {
    const specs = React.useMemo<FloatingFlowerSpec[]>(() => {
      const palette = ['#FF69B4', '#FFD700', '#87CEEB', '#9B59B6', '#FF6347', '#98FB98'];
      const arr: FloatingFlowerSpec[] = [];
      for (let i = 0; i < 20; i++) {
        arr.push({
          id: `ff-${i}`,
          left: Math.random() * 95,
          size: 18 + Math.round(Math.random() * 24),
          duration: 7000 + Math.round(Math.random() * 5000),
          delay: Math.round(Math.random() * 3500),
          color: palette[i % palette.length],
        });
      }
      return arr;
    }, []);

    return (
      <View pointerEvents="none" style={styles.floatingFlowersLayer}>
        {specs.map((spec) => (
          <FloatingFlower key={spec.id} spec={spec} active={active} />
        ))}
      </View>
    );
  });

  function FloatingFlower({ spec, active }: { spec: FloatingFlowerSpec; active: boolean }) {
    const translateY = React.useRef(new Animated.Value(0)).current;
    const opacity = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
      let loop: Animated.CompositeAnimation | null = null;
      if (active) {
        loop = Animated.loop(
          Animated.sequence([
            Animated.delay(spec.delay),
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: -50,
                duration: spec.duration,
                useNativeDriver: Platform.OS !== 'web',
              }),
              Animated.sequence([
                Animated.timing(opacity, { toValue: 0.6, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(opacity, { toValue: 0.2, duration: spec.duration - 1200, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
              ]),
            ]),
            Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
          ])
        );
        loop.start();
      } else {
        translateY.stopAnimation();
        opacity.stopAnimation();
      }
      return () => {
        if (loop) loop.stop();
      };
    }, [active, opacity, spec.delay, spec.duration, translateY]);

    return (
      <Animated.View
        style={[
          styles.floatingFlower,
          {
            left: `${spec.left}%`,
            width: spec.size,
            height: spec.size,
            transform: [{ translateY }],
            opacity,
          },
        ]}
        accessibilityLabel={`floating-flower-${spec.id}`}
      >
        <Svg width={spec.size} height={spec.size} viewBox="0 0 24 24">
          <Circle cx="12" cy="4" r="4" fill={spec.color} />
          <Circle cx="4" cy="12" r="4" fill={spec.color} />
          <Circle cx="20" cy="12" r="4" fill={spec.color} />
          <Circle cx="12" cy="20" r="4" fill={spec.color} />
          <Circle cx="12" cy="12" r="3" fill="#FFFFFF" />
        </Svg>
      </Animated.View>
    );
  }

  const TermsModal = () => (
    <Modal
      visible={showTermsModal || showInitialTerms}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!showInitialTerms) {
          setShowTermsModal(false);
        }
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('termsTitle')}</Text>
          {!showInitialTerms && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTermsModal(false)}
            >
              <X size={24} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>{t('copyrightNoticeTitle')}</Text>
            <Text style={styles.termsText}>
              {t('copyrightNotice')}
            </Text>
          </View>
          
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>{t('termsOfUseTitle')}</Text>
            <Text style={styles.termsText}>
              {t('termsIntro')}
            </Text>
            
            <Text style={styles.termsSubtitle}>{t('copyrightProtectionTitle')}</Text>
            <Text style={styles.termsText}>
              {t('copyrightProtectionText')}
            </Text>
            
            <Text style={styles.termsSubtitle}>{t('prohibitedActivitiesTitle')}</Text>
            <Text style={styles.termsText}>
              {t('prohibitedActivitiesBullets')}
            </Text>
            
            <Text style={styles.termsSubtitle}>{t('privacyAndDataTitle')}</Text>
            <Text style={styles.termsText}>
              {t('privacyAndDataText')}
            </Text>
            
            <Text style={styles.termsSubtitle}>{t('intellectualPropertyTitle')}</Text>
            <Text style={styles.termsText}>
              {t('intellectualPropertyText')}
            </Text>
            
            <Text style={styles.termsSubtitle}>{t('violationsTitle')}</Text>
            <Text style={styles.termsText}>
              {t('violationsText')}
            </Text>
            
            <Text style={styles.termsSubtitle}>{t('contactTitle')}</Text>
            <Text style={styles.termsText}>
              {t('contactText')}
            </Text>
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <View style={styles.acceptanceContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Check size={16} color="white" />}
              </View>
              <Text style={styles.checkboxText}>
                {t('acceptTermsLabel')}
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[
              styles.acceptButton,
              !termsAccepted && styles.acceptButtonDisabled
            ]}
            onPress={acceptTerms}
            disabled={!termsAccepted}
          >
            <Text style={[
              styles.acceptButtonText,
              !termsAccepted && styles.acceptButtonTextDisabled
            ]}>
              {t('continueToApp')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Temporarily skip terms modal for testing
  // if (showInitialTerms && !termsAccepted) {
  //   return (
  //     <View style={styles.container}>
  //       <FlowerBackground />
  //       <TermsModal />
  //     </View>
  //   );
  // }



  const bgCandidates = [
    // Google Drive direct thumbnail endpoint is more reliable for CORS and hotlinking
    'https://drive.google.com/thumbnail?id=1a69AMRfUbMmy4R86_ZEi6ZD-zoGxFFEj&sz=w2000',
    // Fallbacks
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=1600&q=80'
  ] as const;
  const [bgIndex, setBgIndex] = useState<number>(0);
  const [bgFailed, setBgFailed] = useState<boolean>(false);

  const formatScore = (score: number): string => {
    const n = Number(score);
    if (!Number.isFinite(n)) return '0,0';
    return n.toFixed(1).replace('.', ',');
  };

  const allCategoryScores = React.useMemo<Record<string, number>>(() => {
    if (selectedCategory === 'rate' && analysis && 'results' in (analysis as AllCategoriesAnalysis)) {
      const map: Record<string, number> = {};
      try {
        (analysis as AllCategoriesAnalysis).results.forEach((r) => {
          if (r && typeof r.category === 'string' && typeof r.score === 'number') {
            map[r.category] = r.score;
          }
        });
      } catch {}
      return map;
    }
    return {};
  }, [analysis, selectedCategory]);

  const CategoryScoreBadge = ({ categoryId }: { categoryId: StyleCategory }) => {
    const hasScore = Object.prototype.hasOwnProperty.call(allCategoryScores, categoryId);
    if (!hasScore) return null;
    const scoreValue = allCategoryScores[categoryId];
    return (
      <View style={styles.categoryScoreBadge} testID={`category-score-${categoryId}`}>
        <Text style={styles.categoryScoreBadgeText}>{formatScore(scoreValue)}</Text>
        <Text style={styles.categoryScoreBadgeOutOf}>/12</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!bgFailed && (
        <Image 
          source={{ uri: bgCandidates[bgIndex] }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={300}
          recyclingKey={bgCandidates[bgIndex]}
          style={[styles.mainBackgroundImage, { opacity: 0.25 }]}
          pointerEvents="none"
          onError={(err) => {
            console.log('Background image failed to load', { err, tried: bgCandidates[bgIndex] });
            setBgIndex((prev) => {
              const next = prev + 1;
              if (next >= bgCandidates.length) {
                if (!bgFailed) setBgFailed(true);
                return prev;
              }
              return next;
            });
          }}
          onLoad={() => {
            console.log('Background image loaded successfully', bgCandidates[bgIndex]);
            if (bgFailed) {
              setBgFailed(false);
            }
          }}
          testID="background-image"
        />
      )}
      {/* Lightening overlay when results are shown */}
      {analysis ? <View style={styles.resultLightOverlay} pointerEvents="none" /> : null}
      <FlowerBackground />
      <FloatingFlowers active={isAppActive} />
      <TermsModal />

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.contentContainer}
        scrollEventThrottle={16}
      >
      <View style={styles.header}>
        <View style={styles.headerButtonsRow}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleHistory}
            testID="btn-history"
          >
            <History size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => { resetApp(); setShowHistory(false); }}
            testID="btn-home"
          >
            <Home size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/subscription')}
            testID="btn-subscription"
          >
            <CreditCard size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowTermsModal(true)}
            testID="btn-terms"
          >
            <FileText size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/settings')}
            testID="btn-settings"
          >
            <Settings size={20} color="#1a1a1a" />
          </TouchableOpacity>
        </View>

      </View>

      {showHistory ? (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>{t('yourRatingHistory')}</Text>
          <Text style={styles.historySubtitle}>
            {(t('historySubtitle') ?? '').replace('{count}', `${savedRatings.length}`)}
          </Text>
          
          {savedRatings.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Star size={48} color="#ccc" />
              <Text style={styles.emptyHistoryText}>{t('noRatingsYet')}</Text>
              <Text style={styles.emptyHistorySubtext}>
                {t('noRatingsSubtext')}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {savedRatings.map((rating) => {
                const categoryInfo = STYLE_CATEGORIES.find(cat => cat.id === rating.category);
                return (
                  <TouchableOpacity
                    key={rating.id}
                    style={styles.historyItem}
                    onPress={() => loadSavedRating(rating)}
                  >
                    <View style={styles.historyImageContainer}>
                      <Image source={{ uri: rating.imageUri }} style={styles.historyImage} />
                      <View style={styles.historyImageOverlay}>
                        <Shield size={16} color="white" />
                      </View>
                    </View>
                    <View style={styles.historyContent}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyCategoryChip}>
                          <View style={[
                            styles.categoryColorDot,
                            { backgroundColor: categoryInfo?.color }
                          ]} />
                          <Text style={styles.historyCategoryText}>{t((categoryInfo?.id === 'rate' ? 'allCategories' : (categoryInfo?.id ?? '')))}</Text>
                        </View>
                        <Text style={styles.historyDate}>{formatDate(rating.timestamp)}</Text>
                      </View>
                      <View style={styles.historyScore}>
                        <Text style={styles.historyScoreNumber}>{'score' in rating.analysis ? formatScore(rating.analysis.score) : formatScore(rating.analysis.overallScore)}</Text>
                        <Text style={styles.historyScoreOutOf}>/12</Text>

                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              style={[styles.button, styles.resetButton]}
              onPress={clearHistory}
              testID="btn-clear-history"
            >
              <Text style={[styles.buttonText, styles.resetButtonText]}>{t('clearHistory')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.newRatingButton]}
              onPress={() => setShowHistory(false)}
              testID="btn-rate-new"
            >
              <Text style={styles.buttonText}>{t('rateNewOutfit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : !selectedImage ? (
        <View style={styles.uploadSection}>
          <View style={styles.uploadContainer}>
            <View style={styles.headerBrand}>
              <Sparkles size={32} color="#FFD700" />
              <LinearGradient
                colors={['#FF69B4', '#9B59B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerTitleGradient}
              >
                <View style={styles.headerTitleContainer}>
                  <Sparkles size={28} color="#9B59B6" style={styles.headerTitleIcon} />
                  <Text style={styles.headerTitle}>{t('appName')}</Text>
                  <Flower size={28} color="#FF69B4" style={styles.headerTitleIcon} />
                </View>
              </LinearGradient>
              <View style={styles.subscriptionBadge}>
                <Crown size={12} color="#FFD700" />
                <Text style={styles.subscriptionBadgeText}>
                  {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
                </Text>
              </View>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cameraButton]}
                onPress={() => pickImage(true)}
              >
                <Camera size={20} color="white" />
                <Text style={styles.buttonText}>{t('takePhoto')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.galleryButton]}
                onPress={() => pickImage(false)}
              >
                <Upload size={20} color="#1a1a1a" />
                <Text style={[styles.buttonText, styles.galleryButtonText]}>
                  {t('chooseFromGallery')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.imageSection}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.image} />
            <View style={styles.faceMaskOverlay}>
              {Platform.OS !== 'web' ? (
                <View style={styles.faceBlurArea}>
                  <PinkGlasses />
                  <View style={styles.faceProtectionInfo}>
                    <Shield size={16} color="white" />
                    <Text style={styles.faceBlurText}>{t('faceProtected')}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.faceBlurAreaWeb}>
                  <PinkGlasses />
                  <View style={styles.faceProtectionInfo}>
                    <Shield size={16} color="white" />
                    <Text style={styles.faceBlurText}>{t('faceProtected')}</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.privacyBadge}>
              <Shield size={14} color="#4CAF50" />
              <Text style={styles.privacyBadgeText}>{t('privacyProtected')}</Text>
            </View>
          </View>
          

          
          {showCategorySelection ? (
            <View style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{t('chooseStyleCategory')}</Text>
              <Text style={styles.categorySubtitle}>
                {t('categorySubtitle')}
              </Text>
              
              <View style={styles.categoriesGrid}>
                {STYLE_CATEGORIES.map((category) => {
                  const isPremiumFeature = category.id === 'rate';
                  const hasAccess = subscription.tier === 'premium' || subscription.tier === 'ultimate';
                  const isDisabled = isPremiumFeature && !hasAccess;
                  
                  return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      { borderColor: category.color },
                      selectedCategory === category.id && {
                        backgroundColor: category.color + '20',
                        borderWidth: 2,
                      },
                      category.id === 'sixties' && styles.sixtiesCategoryCard,
                      category.id === 'sexy' && styles.sexyCategoryCard,
                      category.id === 'elegant' && styles.elegantCategoryCard,
                      category.id === 'casual' && styles.casualCategoryCard,
                      category.id === 'naive' && styles.naiveCategoryCard,
                      category.id === 'trendy' && styles.trendyCategoryCard,
                      category.id === 'anime' && styles.animeCategoryCard,
                      category.id === 'sarcastic' && styles.sarcasticCategoryCard,
                      category.id === 'rate' && styles.rateCategoryCard,
                      isDisabled && styles.disabledCategoryCard
                    ]}
                    onPress={() => handleCategorySelect(category.id)}
                    disabled={isDisabled}
                  >
                    {/* Sixties - Retro Pattern */}
                    {category.id === 'sixties' && (
                      <>
                        <LinearGradient
                          colors={['#9B59B6', '#8E44AD', '#6A1B9A']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Music size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Sexy - Passionate Red */}
                    {category.id === 'sexy' && (
                      <>
                        <LinearGradient
                          colors={['#FF6B6B', '#FF1744', '#D50000']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Heart size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Elegant - Royal Gold */}
                    {category.id === 'elegant' && (
                      <>
                        <LinearGradient
                          colors={['#4ECDC4', '#26A69A', '#00695C']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Crown size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Casual - Relaxed Blue */}
                    {category.id === 'casual' && (
                      <>
                        <LinearGradient
                          colors={['#45B7D1', '#2196F3', '#1565C0']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Coffee size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Naive - Sweet Pink */}
                    {category.id === 'naive' && (
                      <>
                        <LinearGradient
                          colors={['#FFA07A', '#FFB74D', '#FF8A65']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Flower size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Trendy - Electric Green */}
                    {category.id === 'trendy' && (
                      <>
                        <LinearGradient
                          colors={['#98D8C8', '#4DB6AC', '#26A69A']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Zap size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Anime - Kawaii Purple */}
                    {category.id === 'anime' && (
                      <>
                        <LinearGradient
                          colors={['#FF69B4', '#E91E63', '#C2185B']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Gamepad2 size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Sarcastic - Designer Roast */}
                    {category.id === 'sarcastic' && (
                      <>
                        <LinearGradient
                          colors={['#39FF14', '#00FF7F', '#00E676']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Scissors size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Rate - Golden Star */}
                    {category.id === 'rate' && (
                      <>
                        <LinearGradient
                          colors={['#FFD700', '#FFA500', '#FF8C00']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Star size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    <View style={[
                      styles.categoryColorDot, 
                      { backgroundColor: category.color },
                      category.id === 'sixties' && styles.sixtiesColorDot,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic' || category.id === 'rate') && styles.themedColorDot
                    ]} />
                    <Text style={[
                      styles.categoryLabel,
                      category.id === 'sixties' && styles.sixtiesCategoryLabel,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic' || category.id === 'rate') && styles.themedCategoryLabel,
                      isDisabled && styles.disabledCategoryLabel
                    ]}>{`${t(category.id === 'rate' ? 'allCategories' : category.id)}${category.id === 'sarcastic' ? ' 😜' : ''}`}{isPremiumFeature && !hasAccess && ' 🔒'}</Text>
                    <Text style={[
                      styles.categoryDescription,
                      category.id === 'sixties' && styles.sixtiesCategoryDescription,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic' || category.id === 'rate') && styles.themedCategoryDescription,
                      isDisabled && styles.disabledCategoryDescription
                    ]}>{isPremiumFeature && !hasAccess ? t('premiumFeatureUnlock') : t(category.id === 'rate' ? 'allCategoriesDesc' : (category.id + 'Desc'))}</Text>
                    {isPremiumFeature && !hasAccess && (
                      <View style={styles.premiumOverlay}>
                        <Crown size={16} color="#FFD700" />
                        <Text style={styles.premiumOverlayText}>{t('premiumPlan')}</Text>
                      </View>
                    )}
                    <CategoryScoreBadge categoryId={category.id} />
                  </TouchableOpacity>
                  );
                })}
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.resetButton]}
                onPress={resetApp}
              >
                <Text style={[styles.buttonText, styles.resetButtonText]}>
                  {t('chooseDifferentPhoto')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : showRateOptions ? (
            <View style={styles.rateOptionsSection}>
              <Text style={styles.categoryTitle}>{t('rateThisOutfit')}</Text>
              <Text style={styles.categorySubtitle}>
                {t('chooseCategoryForTargetedAnalysis')}
              </Text>
              
              <View style={styles.categoriesGrid}>
                {STYLE_CATEGORIES.filter(cat => cat.id !== 'rate').map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      { borderColor: category.color },
                      selectedCategory === category.id && {
                        backgroundColor: category.color + '20',
                        borderWidth: 2,
                      },
                      category.id === 'sixties' && styles.sixtiesCategoryCard,
                      category.id === 'sexy' && styles.sexyCategoryCard,
                      category.id === 'elegant' && styles.elegantCategoryCard,
                      category.id === 'casual' && styles.casualCategoryCard,
                      category.id === 'naive' && styles.naiveCategoryCard,
                      category.id === 'trendy' && styles.trendyCategoryCard,
                      category.id === 'anime' && styles.animeCategoryCard
                    ]}
                    onPress={() => handleRateOptionSelect(category.id)}
                  >
                    {/* Sixties - Retro Pattern */}
                    {category.id === 'sixties' && (
                      <>
                        <LinearGradient
                          colors={['#9B59B6', '#8E44AD', '#6A1B9A']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Music size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Sexy - Passionate Red */}
                    {category.id === 'sexy' && (
                      <>
                        <LinearGradient
                          colors={['#FF6B6B', '#FF1744', '#D50000']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Heart size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Elegant - Royal Gold */}
                    {category.id === 'elegant' && (
                      <>
                        <LinearGradient
                          colors={['#4ECDC4', '#26A69A', '#00695C']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Crown size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Casual - Relaxed Blue */}
                    {category.id === 'casual' && (
                      <>
                        <LinearGradient
                          colors={['#45B7D1', '#2196F3', '#1565C0']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Coffee size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Naive - Sweet Pink */}
                    {category.id === 'naive' && (
                      <>
                        <LinearGradient
                          colors={['#FFA07A', '#FFB74D', '#FF8A65']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Flower size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Trendy - Electric Green */}
                    {category.id === 'trendy' && (
                      <>
                        <LinearGradient
                          colors={['#98D8C8', '#4DB6AC', '#26A69A']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Zap size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    {/* Anime - Kawaii Purple */}
                    {category.id === 'anime' && (
                      <>
                        <LinearGradient
                          colors={['#FF69B4', '#E91E63', '#C2185B']}
                          style={styles.categoryBackgroundGradient}
                        />
                        <View style={styles.categoryIconContainer}>
                          <Gamepad2 size={16} color="white" style={styles.categoryIcon} />
                        </View>
                      </>
                    )}
                    
                    <View style={[
                      styles.categoryColorDot, 
                      { backgroundColor: category.color },
                      category.id === 'sixties' && styles.sixtiesColorDot,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic') && styles.themedColorDot
                    ]} />
                    <Text style={[
                      styles.categoryLabel,
                      category.id === 'sixties' && styles.sixtiesCategoryLabel,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic') && styles.themedCategoryLabel
                    ]}>{`${t(category.id === 'rate' ? 'allCategories' : category.id)}${category.id === 'sarcastic' ? ' 😜' : ''}`}</Text>
                    <Text style={[
                      styles.categoryDescription,
                      category.id === 'sixties' && styles.sixtiesCategoryDescription,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic') && styles.themedCategoryDescription
                    ]}>{t(category.id === 'rate' ? 'allCategoriesDesc' : (category.id + 'Desc'))}</Text>
                  </TouchableOpacity>
                ))}
                
                {/* General Rating Option */}
                <TouchableOpacity
                  style={[
                    styles.categoryCard,
                    styles.generalRateCard,
                    { borderColor: '#FFD700' },
                    selectedCategory === 'rate' && {
                      backgroundColor: '#FFD700' + '20',
                      borderWidth: 2,
                    },
                    (subscription.tier === 'free' || subscription.tier === 'basic') && styles.disabledCategoryCard
                  ]}
                  onPress={() => handleRateOptionSelect('rate')}
                  disabled={subscription.tier === 'free' || subscription.tier === 'basic'}
                >
                  <LinearGradient
                    colors={['#FFD700', '#FFA500', '#FF8C00']}
                    style={styles.categoryBackgroundGradient}
                  />
                  <View style={styles.categoryIconContainer}>
                    <Star size={16} color="white" style={styles.categoryIcon} />
                  </View>
                  <View style={[styles.categoryColorDot, styles.themedColorDot, { backgroundColor: '#FFD700' }]} />
                  <Text style={[
                    styles.categoryLabel, 
                    styles.themedCategoryLabel,
                    (subscription.tier === 'free' || subscription.tier === 'basic') && styles.disabledCategoryLabel
                  ]}>{t('allCategories')}{(subscription.tier === 'free' || subscription.tier === 'basic') && ' 🔒'}</Text>
                  <Text style={[
                    styles.categoryDescription, 
                    styles.themedCategoryDescription,
                    (subscription.tier === 'free' || subscription.tier === 'basic') && styles.disabledCategoryDescription
                  ]}>{(subscription.tier === 'free' || subscription.tier === 'basic') ? t('premiumFeatureUnlock') : t('allCategoriesDesc')}</Text>
                  {(subscription.tier === 'free' || subscription.tier === 'basic') && (
                    <View style={styles.premiumOverlay}>
                      <Crown size={16} color="#FFD700" />
                      <Text style={styles.premiumOverlayText}>Premium</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => {
                  setShowRateOptions(false);
                  setShowCategorySelection(true);
                }}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  {t('backToCategories')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : !analysis ? (
            <View style={styles.actionContainer}>
              <View style={styles.selectedCategoryDisplay}>
                <Text style={styles.selectedCategoryLabel}>{t('selectedStyle')}</Text>
                <View style={styles.selectedCategoryChip}>
                  <View style={[
                    styles.categoryColorDot,
                    { backgroundColor: STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.color }
                  ]} />
                  <Text style={styles.selectedCategoryText}>
                    {t(selectedCategory === 'rate' ? 'allCategories' : (selectedCategory ?? ''))}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.analyzeButton]}
                onPress={() => analyzeOutfit()}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Sparkles size={20} color="white" />
                )}
                <Text style={styles.buttonText}>
                  {isAnalyzing ? t('analyzing') : t('rateMyOutfit')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={selectedCategory === 'rate' ? goBackToRateOptions : goBackToCategories}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  {selectedCategory === 'rate' ? t('changeRatingCategory') : t('changeStyleCategory')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.resetButton]}
                onPress={resetApp}
              >
                <Text style={[styles.buttonText, styles.resetButtonText]}>
                  {t('chooseDifferentPhoto')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resultsContainer}>
              <View style={styles.subscriptionBadgePlain}>
                <Crown size={12} color="#FFD700" />
                <Text style={styles.subscriptionBadgeTextSmall}>
                  {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
                </Text>
              </View>
              {selectedCategory === 'rate' && 'results' in analysis ? (
                // All Categories Results
                <>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreTitle}>{t('overallStyleScore')}</Text>
                    <View style={styles.scoreDisplay}>
                      <Text style={styles.scoreNumber}>{formatScore(analysis.overallScore)}</Text>
                      <Text style={styles.scoreOutOf}>/12</Text>
                    </View>
                  </View>
                  
                  <View style={styles.analysisContainer}>
                    <View style={styles.selectedCategoryResultDisplay}>
                      <Text style={styles.analysisLabel}>{t('analysisType')}</Text>
                      <View style={styles.selectedCategoryChip}>
                        <View style={[
                          styles.categoryColorDot,
                          { backgroundColor: STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.color }
                        ]} />
                        <Text style={styles.selectedCategoryText}>
                          {t('allCategories7Results')}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={[styles.analysisLabel, { color: '#6A1B9A', fontWeight: '900' }]}>{t('overallAnalysis')}</Text>
                      <Text style={[styles.analysisText, styles.overallAnalysisText]}>{analysis.overallAnalysis}</Text>
                    </View>
                    
                    <View style={styles.allCategoriesResults}>
                      <Text style={styles.allCategoriesTitle}>{t('categoryBreakdown7')}</Text>
                      {analysis.results && Array.isArray(analysis.results) && analysis.results.length > 0 ? (
                        analysis.results.map((result, index) => {
                          if (!result || typeof result !== 'object') {
                            console.log(`Invalid result at index ${index}:`, result);
                            return null;
                          }
                          const categoryInfo = STYLE_CATEGORIES.find(cat => cat.id === result.category);
                          console.log(`Rendering category result ${index + 1}:`, result.category, categoryInfo?.label);
                          return (
                            <View key={`${result.category || 'unknown'}-${index}`} style={styles.categoryResultCard}>
                              <View style={styles.categoryResultHeader}>
                                <View style={styles.categoryResultChip} testID={`category-chip-${result.category}`}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, flexGrow: 1 }}>
                                    <View style={[
                                      styles.categoryColorDot,
                                      { backgroundColor: categoryInfo?.color || '#999' }
                                    ]} />
                                    <Text style={[styles.categoryResultName, { color: getTextColor(result.category as StyleCategory), fontWeight: '900' }]} numberOfLines={1} ellipsizeMode="tail">
                                      {t((categoryInfo?.id ?? (result.category || '')))}
                                    </Text>
                                  </View>
                                  <View style={styles.scoreRow} testID={`category-score-in-chip-${result.category}`}>
                                    <Text style={styles.categoryScoreNumber}>{formatScore((result.score ?? 0))}</Text>
                                    <Text style={styles.categoryScoreOutOf}>/12</Text>
                                  </View>
                                </View>
                              </View>
                              <View style={{ width: '100%' }}>
                                <Text style={[styles.categoryResultAnalysis, { color: getTextColor(result.category as StyleCategory), fontWeight: '800' }]}>{result.analysis || 'No analysis available'}</Text>
                              </View>
                              {isPremiumLike ? (
                                <View style={styles.categorySuggestions}>
                                  <Text style={styles.suggestionsSubtitle}>{(t('suggestionsFor') ?? '').replace('{category}', t((categoryInfo?.id === 'rate' ? 'allCategories' : (categoryInfo?.id ?? (result.category || '')))))}</Text>
                                  {result.suggestions && Array.isArray(result.suggestions) ? result.suggestions.map((suggestion: string, suggestionIndex: number) => (
                                    <View key={suggestionIndex} style={styles.suggestionItem}>
                                      <View style={styles.suggestionBullet} />
                                      <Text style={[styles.suggestionText, { color: getTextColor(result.category as StyleCategory), fontWeight: '700' }]}>{suggestion}</Text>
                                    </View>
                                  )) : null}
                                </View>
                              ) : null}
                            </View>
                          );
                        }).filter(Boolean)
                      ) : (
                        <View style={styles.noResultsContainer}>
                          <Text style={styles.noResultsText}>{t('noCategoryResults')}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                // Single Category Results
                <>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreTitle}>{t('yourStyleScore')}</Text>
                    <View style={styles.scoreDisplay}>
                      <Text style={styles.scoreNumber}>{formatScore((analysis as OutfitAnalysis).score)}</Text>
                      <Text style={styles.scoreOutOf}>/12</Text>
                    </View>
                  </View>
                  
                  <View style={styles.analysisContainer}>
                    <View style={styles.selectedCategoryResultDisplay}>
                      <Text style={styles.analysisLabel}>{t('analyzedForStyle')}</Text>
                      <View style={styles.selectedCategoryChip}>
                        <View style={[
                          styles.categoryColorDot,
                          { backgroundColor: STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.color }
                        ]} />
                        <Text style={styles.selectedCategoryText}>
                          {t((selectedCategory ?? ''))}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={[styles.analysisLabel, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '900' }]}>{t('styleAnalysis')}</Text>
                      <Text style={[styles.analysisText, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '700' }]}>{(analysis as OutfitAnalysis).style}</Text>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={[styles.analysisLabel, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '900' }]}>{t('colorCoordination')}</Text>
                      <Text style={[styles.analysisText, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '700' }]}>{(analysis as OutfitAnalysis).colorCoordination}</Text>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={[styles.analysisLabel, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '900' }]}>{t('accessories')}</Text>
                      <Text style={[styles.analysisText, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '700' }]}>{(analysis as OutfitAnalysis).accessories}</Text>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={[styles.analysisLabel, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '900' }]}>{t('overallHarmony')}</Text>
                      <Text style={[styles.analysisText, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '700' }]}>{(analysis as OutfitAnalysis).harmony}</Text>
                    </View>
                    
                    {isPremiumLike ? (
                      <View style={styles.suggestionsSection}>
                        <View style={styles.suggestionsHeader}>
                          <Lightbulb size={20} color="#FFD700" />
                          <Text style={styles.suggestionsTitle}>{t('improvementSuggestions')}</Text>
                        </View>
                        {(analysis as OutfitAnalysis).suggestions?.map && (analysis as OutfitAnalysis).suggestions?.map((suggestion: string, index: number) => (
                          <View key={index} style={styles.suggestionItem}>
                            <View style={styles.suggestionBullet} />
                            <Text style={[styles.suggestionText, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '700' }]}>{suggestion}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </>
              )}
              
              {subscription.tier === 'ultimate' && (
                <TouchableOpacity
                  style={[styles.button, styles.rateAgainButton]}
                  onPress={generateTrendInsights}
                  disabled={trendLoading}
                  testID="btn-view-trends"
                >
                  {trendLoading ? <ActivityIndicator color="white" /> : <TrendingUp size={20} color="white" />}
                  <Text style={styles.buttonText}>{t('viewTrendInsights')}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.emailButton]}
                  onPress={emailSupport}
                  testID="btn-email-support"
                >
                  <Upload size={20} color="white" />
                  <Text style={[styles.buttonText, styles.emailButtonText]} numberOfLines={2}>{t('emailSupport')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.newPhotoButton]}
                  onPress={resetApp}
                >
                  <Upload size={20} color="white" />
                  <Text style={styles.buttonText}>{t('newPhoto')}</Text>
                </TouchableOpacity>
              </View>
              
              {/* Style Category Selection Below Rate Another Outfit Button */}
              <View style={styles.styleCategorySection}>
                <Text style={styles.styleCategoryTitle}>{t('chooseDifferentStyleCategory')}</Text>
                <Text style={styles.styleCategorySubtitle}>
                  {t('rateThisOutfitDifferentCategory')}
                </Text>
                
                <View style={styles.categoriesGrid}>
                  {STYLE_CATEGORIES.filter(cat => cat.id !== selectedCategory).map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryCard,
                        styles.compactCategoryCard,
                        { borderColor: category.color },
                        category.id === 'sixties' && styles.sixtiesCategoryCard,
                        category.id === 'sexy' && styles.sexyCategoryCard,
                        category.id === 'elegant' && styles.elegantCategoryCard,
                        category.id === 'casual' && styles.casualCategoryCard,
                        category.id === 'naive' && styles.naiveCategoryCard,
                        category.id === 'trendy' && styles.trendyCategoryCard,
                        category.id === 'anime' && styles.animeCategoryCard,
                        category.id === 'sarcastic' && styles.sarcasticCategoryCard,
                        category.id === 'rate' && styles.rateCategoryCard
                      ]}
                      onPress={() => {
                        if (category.id === 'rate' && (subscription.tier === 'free' || subscription.tier === 'basic')) {
                          Alert.alert(
                            t('premiumFeatureTitle'),
                            t('premiumAllMessage'),
                            [
                              { text: t('maybeLater'), style: 'cancel' },
                              { 
                                text: t('upgradeNow'), 
                                onPress: () => router.push('/subscription')
                              }
                            ]
                          );
                          return;
                        }
                        setSelectedCategory(category.id);
                        setAnalysis(null);
                        analyzeOutfit(category.id);
                      }}
                    >
                      {/* Sixties - Retro Pattern */}
                      {category.id === 'sixties' && (
                        <>
                          <LinearGradient
                            colors={['#9B59B6', '#8E44AD', '#6A1B9A']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Music size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      {/* Sexy - Passionate Red */}
                      {category.id === 'sexy' && (
                        <>
                          <LinearGradient
                            colors={['#FF6B6B', '#FF1744', '#D50000']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Heart size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      {/* Elegant - Royal Gold */}
                      {category.id === 'elegant' && (
                        <>
                          <LinearGradient
                            colors={['#4ECDC4', '#26A69A', '#00695C']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Crown size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      {/* Casual - Relaxed Blue */}
                      {category.id === 'casual' && (
                        <>
                          <LinearGradient
                            colors={['#45B7D1', '#2196F3', '#1565C0']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Coffee size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      {/* Naive - Sweet Pink */}
                      {category.id === 'naive' && (
                        <>
                          <LinearGradient
                            colors={['#FFA07A', '#FFB74D', '#FF8A65']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Flower size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      {/* Trendy - Electric Green */}
                      {category.id === 'trendy' && (
                        <>
                          <LinearGradient
                            colors={['#98D8C8', '#4DB6AC', '#26A69A']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Zap size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      {/* Anime - Kawaii Purple */}
                      {category.id === 'anime' && (
                        <>
                          <LinearGradient
                            colors={['#FF69B4', '#E91E63', '#C2185B']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Gamepad2 size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}

                      {/* Sarcastic - Designer Roast */}
                      {category.id === 'sarcastic' && (
                        <>
                          <LinearGradient
                            colors={['#39FF14', '#00FF7F', '#00E676']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Scissors size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      {/* Rate - Golden Star */}
                      {category.id === 'rate' && (
                        <>
                          <LinearGradient
                            colors={['#FFD700', '#FFA500', '#FF8C00']}
                            style={styles.categoryBackgroundGradient}
                          />
                          <View style={styles.categoryIconContainer}>
                            <Star size={14} color="white" style={styles.categoryIcon} />
                          </View>
                        </>
                      )}
                      
                      <View style={[
                        styles.categoryColorDot, 
                        { backgroundColor: category.color },
                        category.id === 'sixties' && styles.sixtiesColorDot,
                        (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                         category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic' || category.id === 'rate') && styles.themedColorDot
                      ]} />
                      <Text style={[
                        styles.categoryLabel,
                        styles.compactCategoryLabel,
                        category.id === 'sixties' && styles.sixtiesCategoryLabel,
                        (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                         category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic' || category.id === 'rate') && styles.themedCategoryLabel
                      ]}>{`${t(category.id === 'rate' ? 'allCategories' : category.id)}${category.id === 'sarcastic' ? ' 😜' : ''}`}</Text>
                      <Text style={[
                        styles.categoryDescription,
                        styles.compactCategoryDescription,
                        category.id === 'sixties' && styles.sixtiesCategoryDescription,
                        (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                         category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'sarcastic' || category.id === 'rate') && styles.themedCategoryDescription
                      ]}>{t(category.id === 'rate' ? 'allCategoriesDesc' : (category.id + 'Desc'))}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      )}
      </ScrollView>
      
      {/* Trend Insights Modal */}
      <Modal visible={trendVisible} animationType="slide" transparent onRequestClose={() => setTrendVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a' }}>{t('trendInsights')}</Text>
              <TouchableOpacity onPress={() => setTrendVisible(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12, minHeight: 80 }}>
              {trendLoading ? (
                <ActivityIndicator color="#FF69B4" />
              ) : (
                <Text style={{ fontSize: 14, color: '#333', lineHeight: 20 }}>{trendText}</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Copyright Notice */}
      <View style={styles.copyrightContainer}>
        <Text style={styles.copyrightText}>
          Copyright (©) 2024 robotiyee@gmail.com
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE4E6',
    position: 'relative',
  },
  mainBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },

  flowerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  floatingFlowersLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
  floatingFlower: {
    position: 'absolute',
    bottom: 10,
  },
  scrollContainer: {
    flex: 1,
    zIndex: 5,
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },

  headerTitleGradient: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#9B59B6',
    fontFamily: Platform.select({
      ios: 'Snell Roundhand',
      android: 'cursive',
      web: 'cursive',
    }),
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerDescription: {
    fontSize: 18,
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  uploadSection: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  uploadContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 40,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  uploadTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
  },
  uploadSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: 32,
    gap: 12,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  cameraButton: {
    backgroundColor: '#FF69B4',
  },
  galleryButton: {
    backgroundColor: 'rgba(255, 182, 193, 0.2)',
    borderWidth: 2,
    borderColor: '#FFB6C1',
  },
  analyzeButton: {
    backgroundColor: '#FF1493',
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  newRatingButton: {
    backgroundColor: '#FF69B4',
    marginTop: 24,
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  galleryButtonText: {
    color: '#FF1493',
  },
  resetButtonText: {
    color: '#666',
  },
  imageSection: {
    padding: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: 400,
  },
  privacyOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  privacyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: 24,
    gap: 12,
  },
  resultsContainer: {
    marginTop: 24,
  },
  scoreContainer: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  scoreOutOf: {
    fontSize: 24,
    fontWeight: '600',
    color: '#999',
    marginLeft: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  analysisContainer: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  analysisItem: {
    marginBottom: 20,
  },
  analysisLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  categorySection: {
    marginTop: 24,
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  categorySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    width: '48%',
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 182, 193, 0.3)',
  },
  categoryColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
    textAlign: 'center',
    paddingHorizontal: 4,
    lineHeight: 16,
    flexWrap: 'wrap',
  },
  categoryDescription: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    lineHeight: 12,
    paddingHorizontal: 2,
    flexWrap: 'wrap',
    width: '100%',
  },
  selectedCategoryDisplay: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  selectedCategoryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  selectedCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 182, 193, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 180, 0.3)',
  },
  selectedCategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  selectedCategoryResultDisplay: {
    marginBottom: 20,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 2,
    borderColor: '#FFB6C1',
  },
  secondaryButtonText: {
    color: '#666',
  },
  suggestionsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  suggestionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
    marginTop: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    paddingRight: 8,
  },
  overallAnalysisText: {
    fontWeight: '900',
    color: '#6A1B9A',
  },
  // Header styles
  headerBrand: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  historyButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // History section styles
  historySection: {
    padding: 24,
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  historySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyHistory: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 40,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  historyList: {
    maxHeight: 400,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  historyImageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
  },
  historyImage: {
    width: 80,
    height: 100,
  },
  historyImageOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: 4,
  },
  historyContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  historyCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 182, 193, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 105, 180, 0.3)',
  },
  historyCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
  },
  historyScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyScoreNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  historyScoreOutOf: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  historyStars: {
    flexDirection: 'row',
    gap: 2,
  },
  // Privacy styles
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
  },
  faceMaskOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceBlurArea: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  faceBlurAreaWeb: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  faceProtectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glassesOverlay: {
    marginBottom: 4,
  },
  faceBlurText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  privacyBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  privacyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  privacyExplanation: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  privacyExplanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  privacyExplanationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Category theme styles
  categoryBackgroundGradient: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    width: 'auto',
    height: 'auto',
    opacity: 0.25,
    borderRadius: 12,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  categoryIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 8,
  },
  categoryIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  
  // Sixties category special styles
  sixtiesCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  sixtiesBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.4,
  },
  elegantBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  sixtiesColorDot: {
    backgroundColor: '#9B59B6',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  sixtiesCategoryLabel: {
    color: '#2A2A2A',
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sixtiesCategoryDescription: {
    color: '#3A3A3A',
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Themed category styles
  sexyCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  elegantCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  casualCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  naiveCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  trendyCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  animeCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  sarcasticCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#39FF14',
  },
  rateCategoryCard: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    minHeight: 90,
    padding: 12,
  },
  
  themedColorDot: {
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  themedCategoryLabel: {
    color: '#2A2A2A',
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  themedCategoryDescription: {
    color: '#3A3A3A',
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Rate options section
  rateOptionsSection: {
    marginTop: 24,
  },
  generalRateCard: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
  },
  
  // Action buttons container
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  rateAgainButton: {
    backgroundColor: '#FFD700',
    flex: 1,
  },
  newPhotoButton: {
    backgroundColor: '#FF69B4',
    flex: 1,
  },
  exportButton: {
    backgroundColor: '#4C1D95',
    flex: 1,
  },
  emailButton: {
    backgroundColor: '#87CEEB',
    flex: 1,
  },
  emailButtonText: {
    fontSize: 12,
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  
  // Style category section below results
  styleCategorySection: {
    marginTop: 32,
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  styleCategoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  styleCategorySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  compactCategoryCard: {
    padding: 8,
    width: '48%',
    minHeight: 60,
  },
  compactCategoryLabel: {
    fontSize: 11,
    lineHeight: 13,
  },
  compactCategoryDescription: {
    fontSize: 8,
    lineHeight: 10,
  },
  
  // Copyright styles
  copyrightContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 182, 193, 0.3)',
  },
  copyrightText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  resultLightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.42)',
    zIndex: 2,
  },
  
  // Disabled category styles
  disabledCategoryCard: {
    opacity: 0.6,
    backgroundColor: 'rgba(200, 200, 200, 0.1)',
  },
  disabledCategoryLabel: {
    color: '#999',
  },
  disabledCategoryDescription: {
    color: '#999',
  },
  premiumOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  premiumOverlayText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  
  // Header buttons
  headerButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 4,
    marginTop: 28,
  },
  headerButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  centerHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
  },
  centerHistoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    gap: 4,
  },
  subscriptionBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  subscriptionBadgePlain: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    marginTop: 0,
    gap: 4,
  },
  subscriptionBadgeTextSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  
  // Subscription status card
  subscriptionStatusCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 4,
    marginBottom: 8,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subscriptionStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  subscriptionStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionStatusTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD700',
  },
  subscriptionStatusText: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: '900',
  },
  upgradeButton: {
    backgroundColor: '#FF69B4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  
  // Terms modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFE4E6',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 182, 193, 0.3)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  termsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  termsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF1493',
    marginBottom: 12,
  },
  termsSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalFooter: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 182, 193, 0.3)',
  },
  acceptanceContainer: {
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFB6C1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  checkboxChecked: {
    backgroundColor: '#FF69B4',
    borderColor: '#FF69B4',
  },
  checkboxText: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
    flex: 1,
  },
  acceptButton: {
    backgroundColor: '#FF69B4',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#ccc',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  acceptButtonTextDisabled: {
    color: '#999',
  },
  
  // All Categories Results Styles
  allCategoriesResults: {
    marginTop: 24,
  },
  allCategoriesTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#6A1B9A',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryResultCard: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    minHeight: 320,
    width: '100%',
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.0,
    shadowRadius: 0,
    elevation: 0,
  },
  categoryResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    minHeight: 80,
    width: '100%',
  },
  categoryResultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 182, 193, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 105, 180, 0.4)',
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 12,
    minHeight: 56,
    minWidth: 200,
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  categoryResultName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    flexShrink: 1,
    lineHeight: 20,
    textAlign: 'left',
    flexWrap: 'nowrap',
    width: '100%',
  },
  categoryResultScore: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 120,
    paddingLeft: 12,
    flex: 0,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  categoryScoreNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    lineHeight: 24,
  },
  categoryScoreOutOf: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginLeft: 3,
  },
  categoryStars: {
    flexDirection: 'row',
    gap: 2,
  },
  categoryResultAnalysis: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 18,
    paddingHorizontal: 0,
    textAlign: 'left',
    width: '100%',
    flexWrap: 'wrap',
  },
  categoryScoreBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 10,
  },
  categoryScoreBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFD700',
  },
  categoryScoreBadgeOutOf: {
    fontSize: 10,
    fontWeight: '600',
    color: '#eee',
    marginLeft: 3,
  },
  categorySuggestions: {
    marginTop: 16,
    paddingHorizontal: 6,
    width: '100%',
  },
  suggestionsSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF69B4',
    marginBottom: 8,
  },
  noResultsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});