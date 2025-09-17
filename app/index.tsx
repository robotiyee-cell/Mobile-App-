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
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, Upload, Star, Sparkles, Lightbulb, History, Shield, Heart, Crown, Coffee, Flower, Zap, Gamepad2, Music, X, Check, FileText, CreditCard, AlertCircle, Settings, Scissors, TrendingUp, Home } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { useSubscription, SubscriptionTier } from '../contexts/SubscriptionContext';
import { trpc } from '../lib/trpc';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useHistory } from '../contexts/HistoryContext';
import { router, useFocusEffect } from 'expo-router';

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
  planTier?: SubscriptionTier;
  lang?: Language;
}

type StyleCategory = 'sexy' | 'elegant' | 'casual' | 'naive' | 'trendy' | 'anime' | 'sixties' | 'sarcastic' | 'rate';

interface CategoryOption {
  id: StyleCategory;
  label: string;
  description: string;
  color: string;
}

const STYLE_CATEGORIES: CategoryOption[] = [
  { id: 'sexy', label: 'Hot', description: 'Bold, alluring, confident', color: '#FF6B6B' },
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
  sarcastic: '#FF6600',
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
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<OutfitAnalysis | AllCategoriesAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  // Using HistoryContext instead of local state
  const { items: savedRatings, addItem: addHistoryItem, updateItem: updateHistoryItem, removeItem: removeHistoryItem, clearHistory: clearHistoryItems, maxItems } = useHistory();
  const [isAppActive, setIsAppActive] = useState<boolean>(true);
  const isMountedRef = useRef<boolean>(true);
  const ignoreResponsesRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(0);
  const currentAbortRef = useRef<AbortController | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showRateOptions, setShowRateOptions] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showInitialTerms, setShowInitialTerms] = useState<boolean>(true);
  const [shouldResume, setShouldResume] = useState<boolean>(false);
  const [trendVisible, setTrendVisible] = useState<boolean>(false);
  const [trendLoading, setTrendLoading] = useState<boolean>(false);
  const [trendText, setTrendText] = useState<string>('');
  const { subscription, canAnalyze, incrementAnalysisCount, plans } = useSubscription();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isPremiumLike = subscription.tier === 'premium' || subscription.tier === 'ultimate';
  const showSuggestions = subscription.tier !== 'free';

  const displayCategoryName = React.useCallback((id?: string | null): string => {
    if (!id) return '';
    if (id === 'rate') return t('allCategories');
    if (id === 'sexy') return t('sexy');
    return t(id as string);
  }, [t]);

  const currentPlanDef = React.useMemo(() => {
    try {
      return (plans ?? []).find((p: any) => p?.id === subscription.tier);
    } catch {
      return undefined;
    }
  }, [plans, subscription.tier]);

  const planHierarchyText = React.useMemo(() => {
    const emoji = currentPlanDef?.emojiIcon ?? '';
    const planet = currentPlanDef?.planet ?? '';
    const myth = currentPlanDef?.mythology ?? '';
    const label = `${emoji} ${planet} · ${myth}`.trim();
    return label.length > 0 ? label : (subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1));
  }, [currentPlanDef?.emojiIcon, currentPlanDef?.planet, currentPlanDef?.mythology, subscription.tier]);

  function ensureParagraph(text: string, category: string, lang: Language): string {
    try {
      const minSentences = 3;
      const maxSentences = 4;
      const split = (text || '').trim().replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(Boolean);
      if (split.length >= minSentences) return text;
      const extrasEn = [
        `Tie the idea back to the ${category} aesthetic with one clear focal point rather than many small accents.`,
        'Refine fit at one seam (waist, shoulder, or hem) to make the silhouette feel intentional and premium.',
        'Keep the color story cohesive by repeating one accent hue twice for balance and coherence.'
      ];
      const extrasTr = [
        `${category} estetiğine geri bağlamak için birçok küçük detay yerine tek ve net bir odak noktası seç.`,
        'Silüetin bilinçli ve kaliteli görünmesi için bir dikiş noktasında (bel, omuz veya etek ucu) kalıbı incelt.',
        'Renk hikâyesini tutarlı tutmak için bir vurgu rengini görünümde iki kez tekrar et.'
      ];
      const pool = lang === 'tr' ? extrasTr : extrasEn;
      const needed = Math.min(maxSentences - split.length, pool.length);
      const extended = (text || '').trim() + ' ' + pool.slice(0, needed).join(' ');
      return extended.trim();
    } catch {
      return text;
    }
  }

  function limitSentences(text: string, max: number): string {
    try {
      const split = (text || '').trim().replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(Boolean);
      return split.slice(0, Math.max(1, max)).join(' ').trim();
    } catch {
      return text;
    }
  }

  const generateShortSuggestions = React.useCallback((category: string, lang: Language): string[] => {
    const base: Record<string, { en: string[]; tr: string[] }> = {
      sexy: { 
        en: [
          'Define the waist with a fitted piece and streamline layers. Consider a deeper neckline or a hem adjustment for a confident, body-conscious silhouette.',
          'Swap muted tones for richer blacks or reds and add one statement heel or cuff. Keep everything else clean to avoid visual clutter.'
        ], 
        tr: [
          'Bel hattını vurgulayan dar bir parça ile katmanları sadeleştir. Daha iddialı bir yaka ya da etek boyu ayarıyla özgüvenli, vücut odaklı bir silüet yakalayabilirsin.',
          'Soluk tonları daha zengin siyah veya kırmızılarla değiştir ve tek bir iddialı topuklu ya da bileklik ekle. Diğer öğeleri temiz ve sade tut.'
        ] 
      },
      elegant: { 
        en: [
          'Upgrade fabrics to something with a finer hand (silk, wool blend) and tailor the shoulder and waist. This instantly sharpens the line and reads polished.',
          'Keep jewelry minimal and coordinated, then introduce a structured shoe or bag. A restrained palette (navy, cream) will elevate the whole look.'
        ], 
        tr: [
          'Kumaş kalitesini (ipek, yün karışımı) yükseltip omuz ve beli terzi işi daralt. Bu, çizgiyi anında netleştirir ve daha derli toplu görünür.',
          'Takıları minimal ve uyumlu tut; ardından yapılandırılmış bir ayakkabı veya çanta ekle. Sınırlı bir palet (lacivert, krem) tüm görünümü yükseltir.'
        ] 
      },
      casual: { 
        en: [
          'Balance the relaxed base with one structured layer like a light jacket or crisp shirt. Keep the palette to two or three colors to stay effortless.',
          'Choose breathable textures (cotton, denim) and roll sleeves or hems slightly. A simple sneaker cleans up the look without trying too hard.'
        ], 
        tr: [
          'Rahat temeli hafif bir ceket veya düzgün bir gömlek gibi tek bir yapılandırılmış katmanla dengele. Paleti iki-üç renkle sınırlayıp zahmetsiz kal.',
          'Nefes alan dokular (pamuk, denim) seç; kol ya da paçayı hafifçe kıvır. Basit bir spor ayakkabı, abartmadan görünümü toparlar.'
        ] 
      },
      naive: { 
        en: [
          'Introduce soft pastels or a tiny playful print and choose gentler A-line shapes. Keep hardware and edges rounded to preserve sweetness.',
          'Swap harsh contrasts for milky tones and add a small bow or delicate hair clip. Light, floaty fabrics will enhance the youthful vibe.'
        ], 
        tr: [
          'Yumuşak pasteller veya minik eğlenceli bir desen ekleyip daha nazik A-hatlı formları seç. Metal detayları ve köşeleri yuvarlayarak tatlılığı koru.',
          'Sert kontrastlar yerine sütlü tonlara geç ve küçük bir fiyonk ya da zarif bir toka ekle. Hafif, uçuşan kumaşlar genç havayı güçlendirir.'
        ] 
      },
      trendy: { 
        en: [
          'Anchor the look with one on-trend hero piece (bag, shoe or jacket) and mix two textures. Keep proportions crisp and modern for a feed-ready finish.',
          'Introduce a current color accent and edit accessories down. Sharp tailoring with a playful twist will push it into trend territory.'
        ], 
        tr: [
          'Görünümü tek bir trend yıldız parçayla (çanta, ayakkabı veya ceket) sabitle ve iki dokuyu karıştır. Oranları net ve modern tut ki paylaşıma hazır dursun.',
          'Güncel bir renk vurgusu ekleyip aksesuarları azalt. Oyuncu bir dokunuşla keskin terzilik, görünümü trend seviyesine taşır.'
        ] 
      },
      anime: { 
        en: [
          'Add a cute accent in a bright hue and layer playful accessories sparingly. Rounded shapes and glossy finishes keep it kawaii rather than chaotic.',
          'Consider color-blocked socks or a charm detail on the bag. A micro print or pastel hairpiece will amplify the animated vibe.'
        ], 
        tr: [
          'Parlak bir tonda sevimli bir vurgu ekleyip eğlenceli aksesuarları ölçülü katmanla. Yuvarlak formlar ve parlak dokular kaosu önleyip kawaii havayı korur.',
          'Renk bloklu çoraplar veya çantada küçük bir süs detayı düşün. Minik bir desen ya da pastel bir saç aksesuarı animasyon etkisini artırır.'
        ] 
      },
      sixties: { 
        en: [
          'Lean into an A-line or shift silhouette and choose bold geometrics or pop florals. White boots or a headband will signal authentic mod references.',
          'Keep the palette saturated and accessories graphic. A short hem with clean lines will make the retro read intentional and fresh.'
        ], 
        tr: [
          'A-hatlı veya shift silüete yönelip cesur geometrikler ya da pop çiçekler seç. Beyaz bot veya bir saç bandı, özgün mod referanslarını güçlendirir.',
          'Paleti doygun tut ve aksesuarları grafik bırak. Temiz çizgili kısa bir etek boyu, retro etkisini bilinçli ve taze gösterir.'
        ] 
      },
      rate: { 
        en: [
          'Clarify the target vibe per category and unify the palette across pieces. Adjust fit slightly where needed so each style reads intentional.',
          'Elevate cohesion with one bridging accessory and tidy proportions. Minor tailoring plus a focused color story will lift all seven scores.'
        ], 
        tr: [
          'Her kategori için hedef hissi netleştirip parçalar arasında paleti birleştir. Gerekli yerlerde kalıbı hafifçe ayarla ki her stil bilinçli okunsun.',
          'Tek bir köprüleyici aksesuar ve düzenli oranlarla uyumu yükselt. Ufak terzilik ve odaklı bir renk hikâyesi tüm yedi skoru yukarı çeker.'
        ] 
      },
    };
    const key = (category as keyof typeof base) || 'rate';
    const pack = base[key] ?? base.rate;
    const arr = (lang === 'tr' ? pack.tr : pack.en).slice(0, 2);
    return arr.map((s) => limitSentences(s, 2));
  }, []);
  const activeAnalysisIdRef = useRef<string | null>(null);
  const savedForActiveIdRef = useRef<boolean>(false);
  const currentHistoryIdRef = useRef<string | null>(null);

  useEffect(() => {
    checkTermsAcceptance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    return () => {
      try {
        if (currentAbortRef.current) {
          currentAbortRef.current.abort();
        }
      } catch {}
    };
  }, []);

  const startMutation = trpc.analysis.start.useMutation();
  const statusQuery = trpc.analysis.status.useQuery(
    { jobId: jobId ?? '' },
    {
      enabled: !!jobId,
      refetchInterval: isAppActive && isAnalyzing ? 1500 : false,
      staleTime: 0,
    }
  );

  const cancelAnalysis = React.useCallback(() => {
    try {
      ignoreResponsesRef.current = true;
      if (currentAbortRef.current) {
        currentAbortRef.current.abort();
      }
    } catch {}
    activeAnalysisIdRef.current = null;
    savedForActiveIdRef.current = false;
    setIsAnalyzing(false);
    setJobId(null);
  }, []);

  const confirmEndAnalysis = React.useCallback(async (): Promise<boolean> => {
    if (!isAnalyzing || !selectedCategory) return true;
    cancelAnalysis();
    return true;
  }, [cancelAnalysis, isAnalyzing, selectedCategory]);

  useEffect(() => {
    isMountedRef.current = true;

    const handleStateChange = (nextState: AppStateStatus) => {
      const active = nextState === 'active';
      setIsAppActive(active);
      ignoreResponsesRef.current = false;
      // Do not cancel analysis on background; allow request to continue. If it fails, we auto-resume when active.
      if (active && shouldResume && selectedImage && selectedCategory && !isAnalyzing) {
        setShouldResume(false);
        setTimeout(() => {
          if (isMountedRef.current && !isAnalyzing) {
            analyzeOutfit();
          }
        }, 250);
      }
    };

    const sub = AppState.addEventListener('change', handleStateChange);

    return () => {
      isMountedRef.current = false;
      sub.remove();
    };
  }, [shouldResume, selectedImage, selectedCategory, isAnalyzing]);

  useFocusEffect(
    React.useCallback(() => {
      console.log('Screen focused');
      ignoreResponsesRef.current = false;
      if (shouldResume && selectedImage && selectedCategory && !isAnalyzing) {
        setShouldResume(false);
        setTimeout(() => {
          if (isMountedRef.current && !isAnalyzing) {
            analyzeOutfit();
          }
        }, 250);
      }
      return () => {
        console.log('Screen blurred');
        // Do not cancel analysis when navigating away; avoid warnings.
      };
    }, [shouldResume, selectedImage, selectedCategory, isAnalyzing])
  );

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

  // Convert SavedRating to HistoryItem format
  const convertToHistoryItem = (rating: SavedRating) => {
    const score = 'score' in rating.analysis ? rating.analysis.score : rating.analysis.overallScore;
    return {
      id: rating.id,
      createdAt: new Date(rating.timestamp).toISOString(),
      imageUri: rating.imageUri,
      thumbnailUri: rating.maskedImageUri,
      selectedCategory: rating.category as any,
      score: score,
      analysisSummary: 'style' in rating.analysis ? rating.analysis.style : rating.analysis.overallAnalysis,
      details: JSON.stringify(rating.analysis),
      lang: rating.lang,
    };
  };

  const saveRating = async (rating: SavedRating): Promise<string> => {
    try {
      const historyItem = convertToHistoryItem(rating);
      await addHistoryItem(historyItem);
      return historyItem.id;
    } catch (error) {
      console.log('Error saving rating:', error);
      return rating.id;
    }
  };

  const maskFaceInImage = async (imageUri: string): Promise<string> => {
    try {
      if (Platform.OS === 'web') {
        return imageUri;
      } else {
        return imageUri;
      }
    } catch (error) {
      console.log('Error masking image:', error);
      return imageUri;
    }
  };

  const uriToBase64Raw = async (uri: string): Promise<string> => {
    try {
      if (!uri) return '';
      if (uri.startsWith('data:')) {
        const parts = uri.split(',');
        return parts[1] ?? '';
      }
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
        const blob = await res.blob();
        const ab = await blob.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(ab);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
        if (typeof btoa === 'function') return btoa(binary);
        const Buf = (globalThis as any)?.Buffer;
        return (Buf ? Buf.from(binary, 'binary').toString('base64') : '');
      }
      if (uri.startsWith('content://')) {
        try {
          const dest = (FileSystem.cacheDirectory ?? '') + `img-${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: uri, to: dest });
          return await FileSystem.readAsStringAsync(dest, { encoding: FileSystem.EncodingType.Base64 });
        } catch (copyErr) {
          console.log('content URI copy failed, trying direct read', copyErr);
        }
      }
      return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    } catch (e) {
      console.log('uriToBase64Raw failed', e);
      throw e as Error;
    }
  };

  const uriToBase64 = async (uri: string): Promise<string> => {
    const raw = await uriToBase64Raw(uri);
    if (raw.length > MAX_BASE64_CHARS && Platform.OS !== 'web') {
      const compressed = await compressImageToBase64(uri);
      return compressed.length > 0 ? compressed : raw;
    }
    return raw;
  };

  const MAX_BASE64_CHARS = 1_200_000 as const;

  const compressImageToBase64 = async (
    uri: string,
    maxWidth: number = 1280,
    quality: number = 0.7,
  ): Promise<string> => {
    try {
      if (!uri) return '';
      if (Platform.OS === 'web') {
        return await new Promise<string>((resolve) => {
          try {
            const img = document.createElement('img');
            (img as any).crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const scale = Math.min(1, maxWidth / (img.width || maxWidth));
                const w = Math.max(1, Math.round((img.width || maxWidth) * scale));
                const h = Math.max(1, Math.round((img.height || maxWidth) * scale));
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  resolve('');
                  return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', Math.min(1, Math.max(0.1, quality)));
                const parts = dataUrl.split(',');
                resolve(parts[1] ?? '');
              } catch (e) {
                console.log('web canvas compress failed', e);
                resolve('');
              }
            };
            (img as HTMLImageElement).onerror = () => resolve('');
            (img as HTMLImageElement).src = uri;
          } catch (e) {
            console.log('web init compress failed', e);
            resolve('');
          }
        });
      }
      // Native (iOS/Android): iteratively downscale + compress with expo-image-manipulator
      const tryScales = [maxWidth, 1280, 1024, 900, 800, 700, 600, 512, 448, 384];
      const q = Math.min(1, Math.max(0.2, quality));
      for (let i = 0; i < tryScales.length; i++) {
        const target = tryScales[i];
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: target } }],
            { compress: q, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          const b64 = manipulated.base64 ?? '';
          if (b64.length === 0) continue;
          if (b64.length <= MAX_BASE64_CHARS || i === tryScales.length - 1) {
            return b64;
          }
        } catch (err) {
          console.log('manipulateAsync failed at scale', target, err);
          // Fallthrough to next smaller scale
        }
      }
      return '';
    } catch (e) {
      console.log('compressImageToBase64 failed', e);
      return '';
    }
  };

  const pickImage = async (useCamera: boolean = false) => {
    try {
      if (isAnalyzing) {
        const proceed = await confirmEndAnalysis();
        if (!proceed) return;
      }
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
          quality: 0.6,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.6,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        try {
          let b64 = (result as ImagePicker.ImagePickerSuccessResult).assets?.[0]?.base64 ?? '';
          if (!b64 || b64.length === 0) {
            b64 = await uriToBase64(imageUri);
          }
          setSelectedImageBase64(b64);
        } catch (e) {
          console.log('compress on pick failed', e);
          setSelectedImageBase64(null);
        }
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

      const softMin = 10;

      if (category === 'rate') {
        const a = data as AllCategoriesAnalysis;
        if (!Array.isArray(a.results) || a.results.length !== 7) return { ok: false, reason: 'invalid_results_count' };
        for (const r of a.results) {
          if (!r || typeof r !== 'object') return { ok: false, reason: 'result_not_object' };
          if (typeof (r as CategoryResult).category !== 'string') return { ok: false, reason: 'missing_category' };
          const sc = Number((r as CategoryResult).score);
          if (!Number.isFinite(sc) || sc <= 0 || sc > 12) return { ok: false, reason: 'invalid_score' };
          if (!validateTextQuality((r as CategoryResult).analysis, softMin)) return { ok: false, reason: 'analysis_too_short' };
        }
        const overall = Number((a as AllCategoriesAnalysis).overallScore);
        if (!Number.isFinite(overall) || overall <= 0) return { ok: false, reason: 'overall_invalid' };
        if (!validateTextQuality((a as AllCategoriesAnalysis).overallAnalysis, softMin)) return { ok: false, reason: 'overall_too_short' };
        return { ok: true };
      }

      const a = data as OutfitAnalysis;
      const sc = Number(a.score);
      if (!Number.isFinite(sc) || sc <= 0 || sc > 12) return { ok: false, reason: 'invalid_score' };
      if (!validateTextQuality(a.style, softMin)) return { ok: false, reason: 'style_short' };
      if (!validateTextQuality(a.colorCoordination, softMin)) return { ok: false, reason: 'color_short' };
      if (!validateTextQuality(a.accessories, softMin)) return { ok: false, reason: 'accessories_short' };
      if (!validateTextQuality(a.harmony, softMin)) return { ok: false, reason: 'harmony_short' };
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

    setDesignMatchText('');
    setDesignMatchLoading(false);
    setIsAnalyzing(true);
    const thisReq = ++requestIdRef.current;
    if (!retry) {
      activeAnalysisIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      savedForActiveIdRef.current = false;
    }
    try {
      const imageToAnalyze = maskedImage || selectedImage;
      let base64Image: string;

      try {
        base64Image = selectedImageBase64 ?? await uriToBase64(imageToAnalyze);
        if (base64Image.length > MAX_BASE64_CHARS && Platform.OS !== 'web') {
          const compressed = await compressImageToBase64(imageToAnalyze);
          if (compressed && compressed.length > 0) {
            base64Image = compressed;
          }
        }
      } catch (error) {
        console.log('Error converting image to base64:', error);
        throw new Error('Failed to process image');
      }

      try {
        const resp = await startMutation.mutateAsync({
          imageBase64: base64Image,
          category: categoryToUse,
          language,
          plan: subscription.tier,
        } as any);
        if (resp && typeof resp === 'object' && (resp as any).jobId) {
          setJobId((resp as { jobId: string }).jobId);
        } else {
          throw new Error('No jobId returned');
        }
        console.log('Analysis job started:', { jobId: (resp as any).jobId, req: thisReq });
      } catch (e) {
        const err = e as { message?: string } | undefined;
        console.log('startMutation failed', err?.message ?? e);
        try {
          const imageToAnalyze = maskedImage || selectedImage;
          const fallback = await compressImageToBase64(imageToAnalyze, 900, 0.6);
          if (fallback && fallback.length > 0) {
            console.log('Retrying analysis with stronger compression');
            const resp2 = await startMutation.mutateAsync({
              imageBase64: fallback,
              category: categoryToUse,
              language,
              plan: subscription.tier,
            } as any);
            if (resp2 && typeof resp2 === 'object' && (resp2 as any).jobId) {
              setJobId((resp2 as { jobId: string }).jobId);
              console.log('Analysis job started on retry:', { jobId: (resp2 as any).jobId, req: thisReq });
              return;
            }
          }
        } catch (retryErr) {
          console.log('Retry failed', retryErr);
        }
        try {
          console.log('Falling back to direct LLM analysis (no backend)');
          const direct = await directLLMAnalysis({ imageBase64: base64Image, category: categoryToUse, language, plan: subscription.tier });
          const validated = validateAnalysis(direct as any, categoryToUse);
          let result: any = direct;
          if (!validated.ok) {
            try {
              if (categoryToUse === 'rate' && direct && (direct as any).results) {
                result = {
                  ...direct,
                  overallAnalysis: ensureParagraph(String((direct as any).overallAnalysis ?? ''), 'overall', language),
                  results: (direct as any).results.map((r: any) => ({
                    ...r,
                    analysis: ensureParagraph(String(r?.analysis ?? ''), String(r?.category ?? 'rate'), language),
                    suggestions: Array.isArray(r?.suggestions) && r.suggestions.length > 0 ? r.suggestions : generateShortSuggestions(String(r?.category ?? 'rate'), language),
                  })),
                };
              } else if (direct && typeof direct === 'object') {
                result = {
                  style: ensureParagraph(String((direct as any).style ?? ''), String(categoryToUse ?? ''), language),
                  colorCoordination: ensureParagraph(String((direct as any).colorCoordination ?? ''), String(categoryToUse ?? ''), language),
                  accessories: ensureParagraph(String((direct as any).accessories ?? ''), String(categoryToUse ?? ''), language),
                  harmony: ensureParagraph(String((direct as any).harmony ?? ''), String(categoryToUse ?? ''), language),
                  score: Number((direct as any).score ?? 0),
                  suggestions: Array.isArray((direct as any).suggestions) && (direct as any).suggestions.length > 0 ? (direct as any).suggestions : generateShortSuggestions(String(categoryToUse ?? 'rate'), language),
                } as OutfitAnalysis;
              }
            } catch {}
          }
          setAnalysis(result);
          incrementAnalysisCount();
          if (!savedForActiveIdRef.current && selectedImage && categoryToUse) {
            const rating: SavedRating = {
              id: Date.now().toString(),
              imageUri: selectedImage,
              maskedImageUri: maskedImage || undefined,
              category: categoryToUse,
              analysis: result,
              timestamp: Date.now(),
              planTier: subscription.tier,
            };
            (async () => {
              const hid = await saveRating({ ...rating, lang: language });
              currentHistoryIdRef.current = hid;
            })();
          }
          setIsAnalyzing(false);
          setJobId(null);
          return;
        } catch (directErr) {
          console.log('Direct LLM analysis failed', directErr);
        }
        Alert.alert(t('error'), t('failedToAnalyze'));
        setIsAnalyzing(false);
        return;
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string } | undefined;
      const msg = (e?.message ?? '').toLowerCase();
      const aborted = (e?.name === 'AbortError') || msg.includes('abort') || msg.includes('network request failed') || msg.includes('network connection lost');
      if (aborted || !isAppActive) {
        console.log('Analysis paused/interrupted; will resume automatically when app is active. Error:', e?.message ?? 'unknown');
        setShouldResume(true);
      } else {
        Alert.alert(t('error'), t('failedToAnalyze'));
      }
    } finally {
      if (currentAbortRef.current) currentAbortRef.current = null;
    }
  };

  const resetApp = async () => {
    if (isAnalyzing && !!selectedCategory) {
      const proceed = await confirmEndAnalysis();
      if (!proceed) return;
    }
    setSelectedImage(null);
    setSelectedImageBase64(null);
    setMaskedImage(null);
    setAnalysis(null);
    setSelectedCategory(null);
    setShowCategorySelection(false);
    setShowHistory(false);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      setSelectedImage(null);
      setSelectedImageBase64(null);
      setMaskedImage(null);
      setAnalysis(null);
      setSelectedCategory(null);
      setShowCategorySelection(false);
    }
  };

  const translateAnalysisIfNeeded = async (rating: SavedRating): Promise<SavedRating> => {
    try {
      if (!rating || !rating.analysis) return rating;
      if (rating.lang === language) return rating;
      const targetLang = language === 'tr' ? 'Turkish' : 'English';
      const body = {
        messages: [
          { role: 'system', content: `You are a precise translator. Translate the following JSON fields' text content into ${targetLang}. Preserve the JSON structure and all numeric values exactly. Return ONLY JSON.` },
          { role: 'user', content: typeof rating.analysis === 'string' ? rating.analysis : JSON.stringify(rating.analysis) }
        ]
      };
      const res = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      let translated: OutfitAnalysis | AllCategoriesAnalysis = rating.analysis as any;
      if (typeof data?.completion === 'string') {
        let text = data.completion.trim();
        if (text.startsWith('```')) {
          text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
        }
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        const slice = firstBrace !== -1 && lastBrace !== -1 ? text.slice(firstBrace, lastBrace + 1) : text;
        translated = JSON.parse(slice);
      } else if (typeof data?.completion === 'object' && data.completion) {
        translated = data.completion as any;
      }
      const updated: SavedRating = { ...rating, analysis: translated, lang: language };
      // Note: Translation updates are handled by the HistoryContext
      // We don't need to manually update the savedRatings here
      return updated;
    } catch (e) {
      return rating;
    }
  };

  const loadSavedRating = async (historyItem: any) => {
    try {
      setDesignMatchText('');
      setDesignMatchLoading(false);
    } catch {}
    const itemLang: Language | undefined = historyItem?.lang as Language | undefined;
    const rating: SavedRating = {
      id: historyItem.id,
      imageUri: historyItem.imageUri,
      maskedImageUri: historyItem.thumbnailUri,
      category: historyItem.selectedCategory,
      analysis: historyItem.details ? JSON.parse(historyItem.details) : { score: historyItem.score || 0, style: historyItem.analysisSummary || '' },
      timestamp: new Date(historyItem.createdAt).getTime(),
      planTier: subscription.tier,
      lang: itemLang
    };

    let r = rating;
    if ((r.lang ?? 'en') !== language) {
      r = await translateAnalysisIfNeeded(r);
    }
    setSelectedImage(r.imageUri);
    setSelectedImageBase64(null);
    setMaskedImage(r.maskedImageUri || null);
    setSelectedCategory(r.category);
    setAnalysis(r.analysis);
    setShowCategorySelection(false);
    setShowHistory(false);
    try {
      const dm: string = historyItem?.designMatch ?? '';
      setDesignMatchText(dm || '');
      currentHistoryIdRef.current = historyItem?.id ?? null;
    } catch {}
    
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
              await clearHistoryItems();
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

  const handleCategorySelect = async (category: StyleCategory) => {
    console.log('Category selected:', category);
    if (isAnalyzing && category !== selectedCategory) {
      const proceed = await confirmEndAnalysis();
      if (!proceed) return;
    }
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

  const handleRateOptionSelect = async (category: StyleCategory) => {
    if (isAnalyzing && category !== selectedCategory) {
      const proceed = await confirmEndAnalysis();
      if (!proceed) return;
    }
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
      const header = selectedCategory ? `${t('selectedStyle')}: ${displayCategoryName(selectedCategory)}` : t('analysisType');
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

  const [designMatchLoading, setDesignMatchLoading] = useState<boolean>(false);
  const [designMatchText, setDesignMatchText] = useState<string>('');

  interface DesignMatchItem {
    raw: string;
    brand?: string;
    reason?: string;
    confidence?: number;
  }
  interface DesignMatchParsed {
    exact?: DesignMatchItem;
    suggestions: DesignMatchItem[];
  }

  const parseDesignMatch = React.useCallback((text: string, lang: Language): DesignMatchParsed => {
    try {
      const lines = (text || '')
        .split(/\r?\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const exactLabels = [/^exact\s*match\s*:/i, /^tam\s*eşleşme\s*:/i];
      const suggLabels = [/^closest\s*suggestions\s*:/i, /^en\s*yakın\s*öneriler\s*:/i];
      let section: 'exact' | 'suggestions' | 'none' = 'none';
      const parsed: DesignMatchParsed = { suggestions: [] };
      const confRegex = /(confidence|güven\s*düzeyi)\s*:\s*(\d{1,3})\s*%/i;
      const normalizeItem = (line: string): DesignMatchItem => {
        const clean = line.replace(/^[-•\s]+/, '').trim();
        const m = confRegex.exec(clean);
        let confidence: number | undefined = undefined;
        let body = clean;
        if (m && m[2]) {
          confidence = Math.max(0, Math.min(100, Number(m[2])));
          body = clean.replace(m[0], '').trim();
        }
        const parts = body.split(/\s—\s|\s-\s/);
        const brand = parts[0]?.trim();
        let reason = parts.slice(1).join(' — ').trim();
        if (reason) {
          reason = reason.replace(/[—–-]+\s*$/, '').trim();
        }
        return { raw: line, brand: brand || undefined, reason: reason || undefined, confidence };
      };
      for (const line of lines) {
        if (exactLabels.some((r) => r.test(line))) {
          section = 'exact';
          continue;
        }
        if (suggLabels.some((r) => r.test(line))) {
          section = 'suggestions';
          continue;
        }
        if (section === 'exact' && !parsed.exact) {
          parsed.exact = normalizeItem(line);
          continue;
        }
        if (section === 'suggestions') {
          parsed.suggestions.push(normalizeItem(line));
          continue;
        }
        if (line.length > 0) {
          parsed.suggestions.push(normalizeItem(line));
        }
      }
      return parsed;
    } catch {
      return { suggestions: [] };
    }
  }, []);

  const parsedDesignMatch = React.useMemo<DesignMatchParsed>(() => parseDesignMatch(designMatchText, language), [designMatchText, language, parseDesignMatch]);

  const translateDesignMatchIfNeeded = React.useCallback(async (text: string, toLang: Language): Promise<string> => {
    try {
      if (!text || typeof text !== 'string') return text;
      const targetLang = toLang === 'tr' ? 'Turkish' : 'English';
      const body = {
        messages: [
          { role: 'system', content: `Translate the following fashion attribution result to ${targetLang}. Keep the exact lines and structure. Do not add markdown or code fences.` },
          { role: 'user', content: text }
        ]
      };
      const res = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      const completion = typeof data?.completion === 'string' ? data.completion : '';
      if (!completion) return text;
      let translated = completion.trim();
      if (translated.startsWith('```')) {
        translated = translated.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      }
      return translated;
    } catch {
      return text;
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        if (!designMatchText) return;
        const updated = await translateDesignMatchIfNeeded(designMatchText, language);
        if (updated && typeof updated === 'string') {
          setDesignMatchText(updated);
        }
      } catch {}
    })();
  }, [language]);

  async function directLLMAnalysis(input: { imageBase64: string; category: StyleCategory; language: Language; plan: string; }): Promise<OutfitAnalysis | AllCategoriesAnalysis> {
    const systemLang = input.language === 'tr' ? 'Turkish' : 'English';
    const isAll = input.category === 'rate';
    const schemaHint = isAll
      ? `Output STRICT JSON with the following shape:\n{\n  "overallScore": number (1..12),\n  "overallAnalysis": string,\n  "results": [ { "category": "sexy"|"elegant"|"casual"|"naive"|"trendy"|"anime"|"sixties", "score": number (1..12), "analysis": string, "suggestions": string[] } ] (exactly 7 items)\n}\nReturn ONLY JSON, no code fences.`
      : `Output STRICT JSON with the following shape:\n{\n  "style": string,\n  "colorCoordination": string,\n  "accessories": string,\n  "harmony": string,\n  "score": number (1..12),\n  "suggestions": string[]\n}\nReturn ONLY JSON, no code fences.`;
    const messages = [
      { role: 'system' as const, content: `You are a professional fashion stylist and outfit critic focused on the "${input.category}" aesthetic. All outputs MUST be in ${systemLang}. ${schemaHint}` },
      { role: 'user' as const, content: [
        { type: 'text' as const, text: `Analyze this outfit for the "${input.category}" style and rate out of 12. Respond in ${systemLang}. Follow the schema exactly.` },
        { type: 'image' as const, image: `data:image/jpeg;base64,${input.imageBase64}` },
      ]},
    ];
    const res = await fetch('https://toolkit.rork.com/text/llm/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages })
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`llm_http_${res.status}`);
    let data: any;
    try { data = JSON.parse(raw); } catch {
      let txt = raw.trim();
      if (txt.startsWith('```')) txt = txt.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      const fbStart = txt.indexOf('{'); const fbEnd = txt.lastIndexOf('}');
      const jsonSlice = fbStart !== -1 && fbEnd !== -1 && fbEnd > fbStart ? txt.slice(fbStart, fbEnd + 1) : txt;
      data = JSON.parse(jsonSlice);
    }
    const completion = data?.completion as unknown;
    if (typeof completion === 'object' && completion) return completion as any;
    if (typeof completion === 'string') {
      let txt = completion.trim();
      if (txt.startsWith('```')) txt = txt.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      const fbStart = txt.indexOf('{'); const fbEnd = txt.lastIndexOf('}');
      const jsonSlice = fbStart !== -1 && fbEnd !== -1 && fbEnd > fbStart ? txt.slice(fbStart, fbEnd + 1) : txt;
      return JSON.parse(jsonSlice) as any;
    }
    return data as any;
  }

  const generateDesignMatch = async (): Promise<void> => {
    if (!selectedImage) {
      Alert.alert(t('error'), t('failedToAnalyze'));
      return;
    }
    try {
      setDesignMatchLoading(true);
      const imageToAnalyze = maskedImage || selectedImage;
      const base64Image = selectedImageBase64 ?? await uriToBase64(imageToAnalyze);
      const res = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `You are a fashion attribution expert. First try to identify the exact designer or brand from the image. If and only if an exact ID cannot be made with high confidence, list closest alternatives.
Rules:
- Output language: ${language === 'tr' ? 'Turkish' : 'English'}
- Return ONLY plain text. No markdown, no HTML, no code fences.
- Format strictly:
  Exact match: <Brand/Designer> — <1-line reason> — Confidence: <0-100>%
  Closest suggestions:
  - <Brand/Designer> — <1-line reason> — Confidence: <0-100>%
  - <Brand/Designer> — <1-line reason> — Confidence: <0-100>%
  - <Brand/Designer> — <1-line reason> — Confidence: <0-100>%
- If there is an exact match, include the Exact match line first, then the suggestions. If not, omit the Exact match line and only return the Closest suggestions block.
- Be specific about signatures (silhouette, motifs, construction, hardware) and avoid SKU/product names.` },
            { role: 'user', content: [
              { type: 'text', text: 'Identify the exact brand/designer if possible, then give the nearest alternatives with short rationale and confidence.' },
              { type: 'image', image: `data:image/jpeg;base64,${base64Image}` },
            ]}
          ]
        })
      });

      if (!res.ok) {
        setDesignMatchText(language === 'tr' ? 'Eşleşme oluşturulamadı.' : 'Could not generate matches.');
        return;
      }

      const data = await res.json();
      let text = typeof data?.completion === 'string' ? data.completion : '';
      if (!text) {
        setDesignMatchText(language === 'tr' ? 'Eşleşme bulunamadı.' : 'No clear matches.');
        return;
      }
      if (text.startsWith('```')) {
        text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
      }
      text = text.replace(/<[^>]*>/g, '');
      if (language === 'tr') {
        try {
          text = text
            .replace(/\bExact\s*match\s*:/i, 'Tam Eşleşme:')
            .replace(/\bClosest\s*suggestions\s*:/i, 'En Yakın Öneriler:')
            .replace(/\bConfidence\s*:/gi, 'Güven Düzeyi:');
        } catch {}
      }
      const finalText = text.trim();
      setDesignMatchText(finalText);
      try {
        const hid = currentHistoryIdRef.current;
        if (hid) {
          await updateHistoryItem(hid, { designMatch: finalText, lang: language });
        }
      } catch (e) {
        console.log('Failed to update history with design match', e);
      }
    } catch (e) {
      setDesignMatchText(language === 'tr' ? 'Eşleşme oluşturulamadı.' : 'Could not generate matches.');
    } finally {
      setDesignMatchLoading(false);
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
        base64Image = await uriToBase64(imageToAnalyze);
      } catch (error) {
        throw error as Error;
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
          inlineBase64 = await uriToBase64(imageUri);
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
        return `<!doctype html><html><body style=\"font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; background:#FFE4E6; padding:16px;\">\n          <div style=\"max-width:720px;margin:0 auto;background:rgba(255,255,255,0.95);border-radius:16px;padding:16px;\">\n            <h1 style=\"margin:0 0 4px 0;color:#9B59B6;font-style:italic;font-weight:900;\">${safe(t('appName'))}</h1>\n            <div style=\"margin:4px 0 16px 0;color:#FFD700;font-weight:900;font-size:12px;\">\n              <span>${(currentPlanDef?.emojiIcon ?? '') + ' ' + (currentPlanDef?.planet ?? '') + ' · ' + (currentPlanDef?.mythology ?? '')}</span>\n            </div>\n            <div style=\"display:flex;align-items:center;gap:8px;margin-bottom:12px;\">\n              <span style=\"display:inline-block;width:8px;height:8px;border-radius:4px;background:${STYLE_CATEGORIES.find(c=>c.id===selectedCategory)?.color ?? '#FFD700'}\"></span>\n              <span style=\"font-weight:700;color:#1a1a1a;\">${safe(t('selectedStyle'))}:: ${safe(heading)}</span>\n            </div>\n            ${inner}\n            ${imgHtml}\n          </div>\n        </body></html>`;
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

  useEffect(() => {
    try {
      if (!statusQuery.data) return;
      const s = (statusQuery.data as any).status as 'pending' | 'processing' | 'succeeded' | 'failed' | undefined;
      if (!s) return;
      if (s === 'succeeded') {
        let result = (statusQuery.data as any).result as any;
        const validated = validateAnalysis(result, selectedCategory ?? null);
        if (!validated.ok) {
          try {
            if (selectedCategory === 'rate' && result && Array.isArray(result.results)) {
              result = {
                ...result,
                overallAnalysis: ensureParagraph(String(result.overallAnalysis ?? ''), 'overall', language),
                results: result.results.map((r: any) => ({
                  ...r,
                  analysis: ensureParagraph(String(r?.analysis ?? ''), String(r?.category ?? 'rate'), language),
                  suggestions: Array.isArray(r?.suggestions) && r.suggestions.length > 0 ? r.suggestions : generateShortSuggestions(String(r?.category ?? 'rate'), language),
                })),
              };
            } else if (result && typeof result === 'object') {
              result = {
                style: ensureParagraph(String(result.style ?? ''), String(selectedCategory ?? ''), language),
                colorCoordination: ensureParagraph(String(result.colorCoordination ?? ''), String(selectedCategory ?? ''), language),
                accessories: ensureParagraph(String(result.accessories ?? ''), String(selectedCategory ?? ''), language),
                harmony: ensureParagraph(String(result.harmony ?? ''), String(selectedCategory ?? ''), language),
                score: Number(result.score ?? 0),
                suggestions: Array.isArray(result.suggestions) && result.suggestions.length > 0 ? result.suggestions : generateShortSuggestions(String(selectedCategory ?? 'rate'), language),
              } as OutfitAnalysis;
            }
          } catch {}
        }
        if (subscription.tier === 'basic') {
          try {
            if (selectedCategory === 'rate' && result && result.results) {
              result.results = result.results.map((r: any) => ({
                ...r,
                suggestions: (
                  (Array.isArray(r?.suggestions) && r.suggestions.length > 0 ? r.suggestions.slice(0, 2) : generateShortSuggestions(r?.category ?? 'rate', language))
                ).map((s: string) => limitSentences(s, 2)),
              }));
            } else if (result && typeof result === 'object' && (result as any).style !== undefined) {
              const a: any = result as any;
              a.suggestions = (
                Array.isArray(a?.suggestions) && a.suggestions.length > 0 ? a.suggestions.slice(0, 2) : generateShortSuggestions(selectedCategory ?? 'rate', language)
              ).map((s: string) => limitSentences(s, 2));
            }
          } catch {}
        }
        setAnalysis(result);
        incrementAnalysisCount();
        if (!savedForActiveIdRef.current && selectedImage && selectedCategory) {
          const rating: SavedRating = {
            id: Date.now().toString(),
            imageUri: selectedImage,
            maskedImageUri: maskedImage || undefined,
            category: selectedCategory,
            analysis: result,
            timestamp: Date.now(),
            planTier: subscription.tier,
          };
          (async () => {
            const hid = await saveRating({ ...rating, lang: language });
            currentHistoryIdRef.current = hid;
          })();
        }
        setIsAnalyzing(false);
        setJobId(null);
      } else if (s === 'failed') {
        const be = (statusQuery.data as any)?.error as string | undefined;
        setIsAnalyzing(false);
        setJobId(null);
        Alert.alert(t('error'), t('failedToAnalyze'));
      }
    } catch {}
  }, [statusQuery.data]);

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
            onPress={async () => { const shouldConfirm = isAnalyzing && !!selectedCategory; if (shouldConfirm) { const ok = await confirmEndAnalysis(); if (!ok) return; } toggleHistory(); }}
            testID="btn-history"
          >
            <History size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={async () => { const shouldConfirm = isAnalyzing && !!selectedCategory; if (shouldConfirm) { const ok = await confirmEndAnalysis(); if (!ok) return; } await resetApp(); setShowHistory(false); }}
            testID="btn-home"
          >
            <Home size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={async () => { const shouldConfirm = isAnalyzing && !!selectedCategory; if (shouldConfirm) { const ok = await confirmEndAnalysis(); if (!ok) return; } router.push('/subscription'); }}
            testID="btn-subscription"
          >
            <CreditCard size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={async () => { const shouldConfirm = isAnalyzing && !!selectedCategory; if (shouldConfirm) { const ok = await confirmEndAnalysis(); if (!ok) return; } setShowTermsModal(true); }}
            testID="btn-terms"
          >
            <FileText size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={async () => { const shouldConfirm = isAnalyzing && !!selectedCategory; if (shouldConfirm) { const ok = await confirmEndAnalysis(); if (!ok) return; } router.push('/settings'); }}
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
            {(t('historySubtitle') ?? '').replace('{count}', `${savedRatings.length}`)} {maxItems !== -1 && ` (${t('maxItems')}: ${maxItems})`}
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
              {savedRatings.map((historyItem) => {
                const categoryInfo = STYLE_CATEGORIES.find(cat => cat.id === historyItem.selectedCategory);
                return (
                  <TouchableOpacity
                    key={historyItem.id}
                    style={styles.historyItem}
                    onPress={() => loadSavedRating(historyItem)}
                  >
                    <View style={styles.historyImageContainer}>
                      <Image source={{ uri: historyItem.imageUri }} style={styles.historyImage} />
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
                          <Text style={styles.historyCategoryText}>{displayCategoryName(categoryInfo?.id ?? '')}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={styles.planChip}>
                            <Text style={styles.planChipText}>{planHierarchyText}</Text>
                          </View>
                          <Text style={styles.historyDate}>{formatDate(new Date(historyItem.createdAt).getTime())}</Text>
                        </View>
                      </View>
                      <View style={styles.historyScore}>
                        <Text style={styles.historyScoreNumber}>{formatScore(historyItem.score || 0)}</Text>
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
                <Text style={styles.subscriptionBadgeText}>{planHierarchyText}</Text>
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
                    ]}>{`${displayCategoryName(category.id)}${category.id === 'sarcastic' ? ' 😜' : ''}`}{isPremiumFeature && !hasAccess && ' 🔒'}</Text>
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
                    ]}>{`${displayCategoryName(category.id)}${category.id === 'sarcastic' ? ' 😜' : ''}`}</Text>
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
                    {displayCategoryName(selectedCategory)}
                  </Text>
                </View>
                <View style={styles.planInlineChip}>
                  <Crown size={12} color="#FFD700" />
                  <Text style={styles.planInlineChipText}>{planHierarchyText}</Text>
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
                <Text style={styles.subscriptionBadgeTextSmall}>{planHierarchyText}</Text>
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
                                      {displayCategoryName(categoryInfo?.id ?? (result.category || ''))}
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
                              {subscription.tier !== 'free' ? (
                                <View style={styles.categorySuggestions}>
                                  <Text style={styles.suggestionsSubtitle}>{(t('suggestionsFor') ?? '').replace('{category}', displayCategoryName(categoryInfo?.id ?? (result.category || '')))}</Text>
                                  {result.suggestions && Array.isArray(result.suggestions) ? result.suggestions.slice(0, subscription.tier === 'basic' ? 2 : result.suggestions.length).map((suggestion: string, suggestionIndex: number) => (
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
                          {displayCategoryName(selectedCategory)}
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
                    
                    {subscription.tier !== 'free' ? (
                      <View style={styles.suggestionsSection}>
                        <View style={styles.suggestionsHeader}>
                          <Lightbulb size={20} color="#FFD700" />
                          <Text style={styles.suggestionsTitle}>{t('improvementSuggestions')}</Text>
                        </View>
                        {(analysis as OutfitAnalysis).suggestions?.map && (analysis as OutfitAnalysis).suggestions?.slice(0, subscription.tier === 'basic' ? 2 : (analysis as OutfitAnalysis).suggestions.length)?.map((suggestion: string, index: number) => (
                          <View key={index} style={styles.suggestionItem}>
                            <View style={styles.suggestionBullet} />
                            <Text style={[styles.suggestionText, { color: getTextColor(selectedCategory as StyleCategory), fontWeight: '700' }]}>{suggestion}</Text>
                          </View>
                        ))}

                        <View style={styles.designMatchSection}>
                          <View style={styles.suggestionsHeader}>
                            <Sparkles size={20} color={getTextColor((selectedCategory ?? 'rate') as StyleCategory)} />
                            <Text style={[styles.designMatchTitle, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]}>{t('designMatchHeader')}</Text>
                          </View>
                          {designMatchLoading ? (
                            <ActivityIndicator color="#9B59B6" />
                          ) : designMatchText ? (
                            <View style={[styles.designMatchBlock]} testID="design-match-block">
                              {parsedDesignMatch.exact ? (
                                <View style={{ marginBottom: 12 }}>
                                  <Text style={[styles.designMatchSubheader, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]} testID="design-match-exact-title">{language === 'tr' ? 'Tam Eşleşme' : 'Exact match'}</Text>
                                  <View style={styles.designMatchExactRow} testID="design-match-exact-item">
                                    <View style={styles.designMatchIndex}><Text style={[styles.designMatchIndexText, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]}>★</Text></View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={[styles.designMatchBrand, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]} numberOfLines={1} ellipsizeMode="tail">{parsedDesignMatch.exact.brand ?? parsedDesignMatch.exact.raw}</Text>
                                      {parsedDesignMatch.exact.reason ? (
                                        <Text style={[styles.designMatchReason, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]}>{parsedDesignMatch.exact.reason}</Text>
                                      ) : null}
                                    </View>
                                    {typeof parsedDesignMatch.exact.confidence === 'number' ? (
                                      <View style={styles.designMatchConfidenceBadge} testID="design-match-exact-confidence">
                                        <Text style={styles.designMatchConfidenceText}>{parsedDesignMatch.exact.confidence}%</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                              ) : null}
                              {parsedDesignMatch.suggestions && parsedDesignMatch.suggestions.length > 0 ? (
                                <View>
                                  <Text style={[styles.designMatchSubheader, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]} testID="design-match-suggestions-title">{language === 'tr' ? 'En Yakın Öneriler' : 'Closest suggestions'}</Text>
                                  {parsedDesignMatch.suggestions.map((it, idx) => (
                                    <View
                                      key={idx}
                                      style={[
                                        styles.designMatchItemRow,
                                        idx === parsedDesignMatch.suggestions.length - 1 && styles.designMatchItemRowLast,
                                      ]}
                                      testID={`design-match-item-${idx}`}
                                    >
                                      <View style={styles.designMatchIndex}><Text style={[styles.designMatchIndexText, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]}>{idx + 1}</Text></View>
                                      <View style={{ flex: 1 }}>
                                        <Text style={[styles.designMatchBrand, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]} numberOfLines={1} ellipsizeMode="tail">{it.brand ?? it.raw}</Text>
                                        {it.reason ? (
                                          <Text style={[styles.designMatchReason, { color: getTextColor((selectedCategory ?? 'rate') as StyleCategory) }]}>{it.reason}</Text>
                                        ) : null}
                                      </View>
                                      {typeof it.confidence === 'number' ? (
                                        <View style={styles.designMatchConfidenceBadge} testID={`design-match-confidence-${idx}`}>
                                          <Text style={styles.designMatchConfidenceText}>{it.confidence}%</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  ))}
                                </View>
                              ) : null}
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.button, styles.designMatchButton]}
                              onPress={generateDesignMatch}
                              testID="btn-design-match"
                            >
                              <Sparkles size={20} color="white" />
                              <Text style={styles.buttonText}>{t('findDesignMatchButtonHeader')}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
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
                {(() => {
                  const emailDisabled = subscription.tier === 'free' || subscription.tier === 'basic';
                  return (
                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.emailButton,
                        { opacity: emailDisabled ? 0.5 : 1 },
                      ]}
                      onPress={emailSupport}
                      disabled={emailDisabled}
                      testID="btn-email-support"
                    >
                      <Upload size={20} color="white" />
                      <Text
                        style={[
                          styles.buttonText,
                          styles.emailButtonText,
                        ]}
                        numberOfLines={2}
                      >
                        {t('emailSupport')}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
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
                      ]}>{`${displayCategoryName(category.id)}${category.id === 'sarcastic' ? ' 😜' : ''}`}</Text>
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
          Copyright (©) 2024 Looks4Fun
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
    fontFamily: Platform.select({ ios: undefined, android: 'sans-serif', web: 'system-ui' }),
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
  planChip: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  planChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFD700',
  },
  planInlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'center',
  },
  planInlineChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD700',
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

  designMatchSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  designMatchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6A1B9A',
  },
  designMatchText: {
    fontSize: 17,
    color: '#1a1a1a',
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  designMatchBlock: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  designMatchSubheader: {
    fontSize: 14,
    fontWeight: '900',
    color: '#6A1B9A',
    marginBottom: 6,
  },
  designMatchExactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  designMatchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  designMatchIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(155, 89, 182, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  designMatchIndexText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6A1B9A',
  },
  designMatchBrand: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  designMatchReason: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginTop: 2,
  },
  designMatchItemRowLast: {
    borderBottomWidth: 0,
  },
  designMatchConfidenceBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  designMatchConfidenceText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFD700',
  },
  designMatchButton: {
    backgroundColor: '#6A1B9A',
    marginTop: 8,
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