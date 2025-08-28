import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, Upload, Star, Sparkles, Lightbulb, History, Shield, Heart, Crown, Coffee, Flower, Zap, Gamepad2, Music, X, Check, FileText, CreditCard, Settings } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

type StyleCategory = 'sexy' | 'elegant' | 'casual' | 'naive' | 'trendy' | 'anime' | 'sixties' | 'rate';

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
  { id: 'rate', label: 'All', description: 'All categories with 6 results', color: '#FFD700' },
];

export default function OutfitRatingScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [maskedImage, setMaskedImage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<StyleCategory | null>(null);
  const [analysis, setAnalysis] = useState<OutfitAnalysis | AllCategoriesAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [savedRatings, setSavedRatings] = useState<SavedRating[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRateOptions, setShowRateOptions] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showInitialTerms, setShowInitialTerms] = useState(true);
  const [backgroundVisible, setBackgroundVisible] = useState(true);
  
  const { subscription, canAnalyze, incrementAnalysisCount } = useSubscription();

  useEffect(() => {
    loadSavedRatings();
    checkTermsAcceptance();
  }, []);

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
          Alert.alert('Permission needed', 'Camera permission is required to take photos.');
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
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const analyzeOutfit = async () => {
    console.log('analyzeOutfit called with:', { selectedImage: !!selectedImage, selectedCategory });
    if (!selectedImage || !selectedCategory) {
      console.log('Missing required data:', { selectedImage: !!selectedImage, selectedCategory });
      return;
    }

    // Check if user can analyze
    if (!canAnalyze()) {
      Alert.alert(
        'Analysis Limit Reached',
        `You've reached your daily limit of ${subscription.tier === 'free' ? '3' : '15'} analyses. Upgrade to Premium for unlimited analyses!`,
        [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade Now', 
            onPress: () => router.push('/subscription')
          }
        ]
      );
      return;
    }

    setIsAnalyzing(true);
    try {
      const categoryInfo = STYLE_CATEGORIES.find(cat => cat.id === selectedCategory);
      
      // Convert image to base64
      const imageToAnalyze = maskedImage || selectedImage;
      let base64Image: string;
      
      try {
        // Read the image file and convert to base64
        const base64 = await FileSystem.readAsStringAsync(imageToAnalyze, {
          encoding: FileSystem.EncodingType.Base64,
        });
        base64Image = base64;
      } catch (error) {
        console.log('Error converting image to base64:', error);
        // Fallback: try to use the image URI directly if it's already base64
        if (imageToAnalyze.startsWith('data:')) {
          base64Image = imageToAnalyze.split(',')[1];
        } else {
          throw new Error('Failed to process image');
        }
      }
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a professional fashion stylist and outfit critic. The user has indicated they want their outfit analyzed specifically for the "${selectedCategory}" style category (${categoryInfo?.description}).
              
              IMPORTANT: This image has been privacy-protected with face masking before being shared with you. Focus only on the clothing, accessories, and overall styling.
              
              CRITICAL: You MUST analyze this outfit specifically for the "${selectedCategory}" style. Do NOT give generic fashion advice. Your entire analysis should be focused on how well this outfit achieves the specific "${selectedCategory}" aesthetic.
              
              IMPORTANT: Each category has DIFFERENT scoring criteria. The same outfit should receive DIFFERENT scores for different categories based on how well it fits that specific aesthetic.
              
              For the "${selectedCategory}" style specifically:
              ${selectedCategory === 'sexy' ? `
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
              ${selectedCategory === 'elegant' ? `
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
              ${selectedCategory === 'casual' ? `
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
              ${selectedCategory === 'naive' ? `
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
              ${selectedCategory === 'trendy' ? `
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
              ${selectedCategory === 'anime' ? `
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
              ${selectedCategory === 'sixties' ? `
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
              ${selectedCategory === 'rate' ? `
              ALL CATEGORIES ANALYSIS - CRITICAL INSTRUCTIONS:
              You MUST analyze this outfit for ALL 6 style categories and provide 6 completely separate and distinct results.
              
              For EACH of the 6 categories (sexy, elegant, casual, naive, trendy, anime), you must provide:
              - Individual score out of 12 based on how well the outfit fits that SPECIFIC category
              - Detailed analysis of how the outfit performs in that SPECIFIC category
              - 2-3 category-specific suggestions for improvement
              
              IMPORTANT: Each category should have DIFFERENT scores and DIFFERENT analysis based on how the outfit fits that particular style aesthetic.
              
              You MUST return results in this EXACT JSON format with ALL 6 categories:
              {
                "results": [
                  {
                    "category": "sexy",
                    "score": number_out_of_12,
                    "analysis": "detailed analysis specifically for sexy style - how well does this outfit achieve a sexy, alluring, confident look?",
                    "suggestions": ["specific sexy style suggestion 1", "specific sexy style suggestion 2", "specific sexy style suggestion 3"]
                  },
                  {
                    "category": "elegant",
                    "score": number_out_of_12,
                    "analysis": "detailed analysis specifically for elegant style - how well does this outfit achieve a sophisticated, refined, graceful look?",
                    "suggestions": ["specific elegant style suggestion 1", "specific elegant style suggestion 2", "specific elegant style suggestion 3"]
                  },
                  {
                    "category": "casual",
                    "score": number_out_of_12,
                    "analysis": "detailed analysis specifically for casual style - how well does this outfit achieve a relaxed, comfortable, everyday look?",
                    "suggestions": ["specific casual style suggestion 1", "specific casual style suggestion 2", "specific casual style suggestion 3"]
                  },
                  {
                    "category": "naive",
                    "score": number_out_of_12,
                    "analysis": "detailed analysis specifically for naive style - how well does this outfit achieve a sweet, innocent, youthful look?",
                    "suggestions": ["specific naive style suggestion 1", "specific naive style suggestion 2", "specific naive style suggestion 3"]
                  },
                  {
                    "category": "trendy",
                    "score": number_out_of_12,
                    "analysis": "detailed analysis specifically for trendy style - how well does this outfit achieve a fashion-forward, current, stylish look?",
                    "suggestions": ["specific trendy style suggestion 1", "specific trendy style suggestion 2", "specific trendy style suggestion 3"]
                  },
                  {
                    "category": "anime",
                    "score": number_out_of_12,
                    "analysis": "detailed analysis specifically for anime style - how well does this outfit achieve a kawaii, colorful, playful look?",
                    "suggestions": ["specific anime style suggestion 1", "specific anime style suggestion 2", "specific anime style suggestion 3"]
                  }
                ],
                "overallScore": average_of_all_6_scores,
                "overallAnalysis": "comprehensive summary analyzing how this outfit performs across all 6 different style categories, highlighting strengths and areas for improvement"
              }
              
              CRITICAL: You must provide exactly 6 category results. Do not skip any categories. Each result must be unique and tailored to that specific style category.` : ''}
              
              Analyze the outfit with focus on how well it achieves the ${selectedCategory} aesthetic and provide detailed feedback on:
              1. Style - Evaluate how well the outfit embodies the "${selectedCategory}" style and elaborate on the specific elements that contribute to or detract from this aesthetic
              2. Color coordination - How the colors work together for the ${selectedCategory} look specifically
              3. Use of accessories - How accessories enhance or diminish the ${selectedCategory} vibe
              4. Overall harmony - How cohesive the outfit is in achieving the desired ${selectedCategory} aesthetic
              
              Rate the outfit's relevancy to the chosen "${selectedCategory}" category. Give a score out of 12 based on how successfully the outfit achieves the ${selectedCategory} style. 
              
              SCORING GUIDELINES BY CATEGORY:
              - SEXY: Focus on how alluring, confident, and body-conscious the outfit is
              - ELEGANT: Focus on sophistication, refinement, and timeless appeal
              - CASUAL: Focus on comfort, practicality, and effortless wearability
              - NAIVE: Focus on sweetness, innocence, and youthful charm
              - TRENDY: Focus on current fashion trends and modern appeal
              - ANIME: Focus on kawaii elements, bright colors, and playful styling
              - SIXTIES: Focus on authentic 1960s mod elements and retro aesthetics
              - ALL: Analyze across all categories and provide comprehensive results
              
              ${selectedCategory === 'sixties' ? 'For sixties style, prioritize authentic 1960s elements over general fashion appeal. A perfect sixties outfit with authentic mod elements should score 10-12, even if it might not be considered fashionable by today\'s standards.' : ''}
              
              Be constructive but honest in your critique. The SAME OUTFIT should receive DIFFERENT SCORES for different categories. Consider fit, appropriateness for the chosen style, creativity, and overall aesthetic appeal FOR THE ${selectedCategory} STYLE ONLY.
              
              ${selectedCategory !== 'rate' ? `After the analysis, provide 3-5 specific, actionable suggestions to improve the outfit and better achieve the ${selectedCategory} aesthetic. Focus on practical improvements like color changes, accessory additions/removals, fit adjustments, or styling tweaks that would make it more ${selectedCategory}.
              
              Format your response as JSON:
              {
                "style": "detailed analysis of how well the outfit achieves the ${selectedCategory} aesthetic with specific references to ${selectedCategory} style elements",
                "colorCoordination": "analysis of colors and their harmony for the ${selectedCategory} style specifically",
                "accessories": "commentary on accessories and their contribution to the ${selectedCategory} look specifically",
                "harmony": "overall harmony and cohesiveness assessment for the ${selectedCategory} aesthetic specifically",
                "score": number_out_of_12,
                "suggestions": ["specific ${selectedCategory}-focused improvement suggestion 1", "specific ${selectedCategory}-focused improvement suggestion 2", "specific ${selectedCategory}-focused improvement suggestion 3"]
              }` : ''}`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Please analyze this outfit for the "${selectedCategory}" style category and rate it out of 12. The image has been privacy-protected with face masking.`
                },
                {
                  type: 'image',
                  image: `data:image/jpeg;base64,${base64Image}`
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();
      
      try {
        const analysisData = JSON.parse(data.completion);
        setAnalysis(analysisData);
        
        // Increment analysis count
        await incrementAnalysisCount();
        
        // Save the rating
        if (selectedImage && selectedCategory) {
          const rating: SavedRating = {
            id: Date.now().toString(),
            imageUri: selectedImage,
            maskedImageUri: maskedImage || undefined,
            category: selectedCategory,
            analysis: analysisData,
            timestamp: Date.now()
          };
          await saveRating(rating);
        }
      } catch (parseError) {
        console.log('Error parsing analysis response:', parseError);
        
        // Create appropriate fallback based on selected category
        let fallbackAnalysis;
        if (selectedCategory === 'rate') {
          // Fallback for All Categories analysis
          fallbackAnalysis = {
            results: [
              {
                category: "sexy",
                score: 7,
                analysis: "The outfit has some appealing elements but could be more form-fitting and bold to achieve a sexier look.",
                suggestions: ["Try more body-conscious silhouettes", "Add statement accessories", "Consider bolder colors"]
              },
              {
                category: "elegant",
                score: 8,
                analysis: "The outfit shows good sophistication and refinement with classic elements.",
                suggestions: ["Add refined accessories", "Consider neutral tones", "Focus on quality fabrics"]
              },
              {
                category: "casual",
                score: 9,
                analysis: "Perfect for everyday wear with comfortable and practical styling.",
                suggestions: ["Add comfortable layers", "Include practical accessories", "Keep it effortless"]
              },
              {
                category: "naive",
                score: 6,
                analysis: "The outfit could be sweeter and more youthful to achieve the naive aesthetic.",
                suggestions: ["Add pastel colors", "Include cute details", "Try softer silhouettes"]
              },
              {
                category: "trendy",
                score: 7,
                analysis: "The outfit has some modern elements but could be more fashion-forward.",
                suggestions: ["Add current trends", "Try bold patterns", "Include statement pieces"]
              },
              {
                category: "anime",
                score: 5,
                analysis: "The outfit needs more colorful and playful elements to achieve the anime aesthetic.",
                suggestions: ["Add bright colors", "Include kawaii accessories", "Try playful patterns"]
              }
            ],
            overallScore: 7,
            overallAnalysis: "The outfit performs well across different categories, with particular strength in casual and elegant styles. There's room for improvement in more expressive categories like anime and naive styles."
          };
        } else {
          // Fallback for single category analysis
          fallbackAnalysis = {
            style: "Modern casual",
            colorCoordination: "Good color balance",
            accessories: "Well-chosen accessories",
            harmony: "Overall cohesive look",
            score: 8,
            suggestions: ["Try adding a statement accessory", "Consider different color combinations", "Experiment with layering"]
          };
        }
        setAnalysis(fallbackAnalysis);
        
        // Increment analysis count for fallback too
        await incrementAnalysisCount();
        
        // Save fallback rating too
        if (selectedImage && selectedCategory) {
          const rating: SavedRating = {
            id: Date.now().toString(),
            imageUri: selectedImage,
            maskedImageUri: maskedImage || undefined,
            category: selectedCategory,
            analysis: fallbackAnalysis,
            timestamp: Date.now()
          };
          await saveRating(rating);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to analyze outfit. Please try again.');
    } finally {
      setIsAnalyzing(false);
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
          'Premium Feature',
          'The "All Categories" analysis is available for Premium and Ultimate subscribers only. Upgrade now to analyze your outfit across all 6 style categories!',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { 
              text: 'Upgrade Now', 
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
          'Premium Feature',
          'The "All Categories" analysis is available for Premium and Ultimate subscribers only. Upgrade now to analyze your outfit across all 6 style categories!',
          [
            { text: 'Maybe Later', style: 'cancel' },
            { 
              text: 'Upgrade Now', 
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

  const goBackToCategories = () => {
    setShowCategorySelection(true);
    setAnalysis(null);
  };

  const renderScoreStars = (score: number) => {
    const stars = [];
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 !== 0;
    
    for (let i = 0; i < 12; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} size={16} color="#FFD700" fill="#FFD700" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} size={16} color="#FFD700" fill="#FFD700" style={{ opacity: 0.5 }} />
        );
      } else {
        stars.push(
          <Star key={i} size={16} color="#E0E0E0" />
        );
      }
    }
    return stars;
  };

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
    >
      {/* Large decorative flowers with purple, red, pink, yellow, sky blue */}
      <G opacity={Platform.OS === 'ios' ? 0.35 : 0.18}>
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
      <G opacity={Platform.OS === 'ios' ? 0.28 : 0.15}>
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
      <G opacity={Platform.OS === 'ios' ? 0.25 : 0.12}>
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
      <G opacity={Platform.OS === 'ios' ? 0.18 : 0.08}>
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
          <Text style={styles.modalTitle}>Terms and Conditions</Text>
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
            <Text style={styles.termsTitle}>Copyright Notice</Text>
            <Text style={styles.termsText}>
              Copyright (©) 2024 robotiyee@gmail.com. All rights reserved. Unauthorized copying or distribution is prohibited.
            </Text>
          </View>
          
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>Terms of Use</Text>
            <Text style={styles.termsText}>
              By using this application (&quot;L4F&quot;), you agree to the following terms and conditions:
            </Text>
            
            <Text style={styles.termsSubtitle}>1. Copyright Protection</Text>
            <Text style={styles.termsText}>
              This application and all its contents, including but not limited to design, code, graphics, text, and functionality, are protected by copyright law and owned by robotiyee@gmail.com.
            </Text>
            
            <Text style={styles.termsSubtitle}>2. Prohibited Activities</Text>
            <Text style={styles.termsText}>
              You are strictly prohibited from:
              {"\n"}• Copying, reproducing, or distributing any part of this application
              {"\n"}• Reverse engineering or attempting to extract source code
              {"\n"}• Creating derivative works based on this application
              {"\n"}• Using this application for commercial purposes without permission
              {"\n"}• Removing or modifying copyright notices
            </Text>
            
            <Text style={styles.termsSubtitle}>3. Privacy and Data</Text>
            <Text style={styles.termsText}>
              Your privacy is important to us. Face masking technology is used to protect your identity during AI analysis. Only outfit data is processed, ensuring your personal information remains secure.
            </Text>
            
            <Text style={styles.termsSubtitle}>4. Intellectual Property</Text>
            <Text style={styles.termsText}>
              All intellectual property rights in this application remain with robotiyee@gmail.com. No rights are granted to users except for personal, non-commercial use as outlined in these terms.
            </Text>
            
            <Text style={styles.termsSubtitle}>5. Violations</Text>
            <Text style={styles.termsText}>
              Any violation of these terms may result in immediate termination of your access to the application and potential legal action.
            </Text>
            
            <Text style={styles.termsSubtitle}>6. Contact</Text>
            <Text style={styles.termsText}>
              For permissions, licensing inquiries, or questions about these terms, contact: robotiyee@gmail.com
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
                I Accept the Terms and Conditions
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
              Continue to App
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

  const clearDefaultBackground = () => {
    // Toggle background visibility when touching empty areas
    setBackgroundVisible(!backgroundVisible);
    console.log('Background visibility toggled:', !backgroundVisible);
  };

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/q78pfqhb0d2987qqwaf38' }}
        style={[styles.mainBackgroundImage, { opacity: Platform.OS === 'ios' ? (backgroundVisible ? 0.8 : 0.3) : 0.6 }]}
      />
      <FlowerBackground />
      <TermsModal />
      <Pressable 
        style={styles.touchableOverlay}
        onPress={clearDefaultBackground}
      >
        <View style={styles.touchableContent} />
      </Pressable>
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.contentContainer}
        scrollEventThrottle={16}
      >
      <View style={styles.header}>
        
        {/* Header Buttons Row */}
        <View style={styles.headerButtonsRow}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleHistory}
          >
            <History size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/subscription')}
          >
            <CreditCard size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowTermsModal(true)}
          >
            <FileText size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/settings')}
          >
            <Settings size={16} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Title Section */}
        <View style={styles.headerTitleSection}>
          <LinearGradient
            colors={['#FF69B4', '#9B59B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerTitleGradient}
          >
            <View style={styles.headerTitleContainer}>
              <Sparkles size={18} color="#9B59B6" style={styles.headerTitleIcon} />
              <Text style={styles.headerTitle}>Look4Fun</Text>
              <Flower size={18} color="#FF69B4" style={styles.headerTitleIcon} />
            </View>
          </LinearGradient>
          
          <Text style={styles.headerDescription}>Score your look for fun with ai fashion review</Text>
          
          {subscription.tier !== 'free' && (
            <View style={styles.subscriptionBadge}>
              <Crown size={12} color="#FFD700" />
              <Text style={styles.subscriptionBadgeText}>
                {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {showHistory ? (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Your Rating History</Text>
          <Text style={styles.historySubtitle}>
            Your last {savedRatings.length} outfit ratings with privacy protection
          </Text>
          
          {savedRatings.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Star size={48} color="#ccc" />
              <Text style={styles.emptyHistoryText}>No ratings yet</Text>
              <Text style={styles.emptyHistorySubtext}>
                Upload your first outfit to get started!
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
                          <Text style={styles.historyCategoryText}>{categoryInfo?.label}</Text>
                        </View>
                        <Text style={styles.historyDate}>{formatDate(rating.timestamp)}</Text>
                      </View>
                      <View style={styles.historyScore}>
                        <Text style={styles.historyScoreNumber}>{'score' in rating.analysis ? rating.analysis.score : Math.round(rating.analysis.overallScore * 10) / 10}</Text>
                        <Text style={styles.historyScoreOutOf}>/12</Text>
                        <View style={styles.historyStars}>
                          {renderScoreStars('score' in rating.analysis ? rating.analysis.score : rating.analysis.overallScore).slice(0, 5)}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          
          <TouchableOpacity
            style={[styles.button, styles.newRatingButton]}
            onPress={() => setShowHistory(false)}
          >
            <Text style={styles.buttonText}>Rate New Outfit</Text>
          </TouchableOpacity>
        </View>
      ) : !selectedImage ? (
        <View style={styles.uploadSection}>
          {/* Subscription Status Card */}
          <View style={styles.subscriptionStatusCard}>
            <View style={styles.subscriptionStatusHeader}>
              <View style={styles.subscriptionStatusLeft}>
                <Crown size={20} color={subscription.tier === 'free' ? '#9E9E9E' : '#FFD700'} />
                <Text style={styles.subscriptionStatusTitle}>
                  {subscription.tier === 'free' ? 'Free Plan' : 
                   subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1) + ' Plan'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.upgradeButtonText}>
                  {subscription.tier === 'free' ? 'Upgrade' : 'Manage'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subscriptionStatusText}>
              {subscription.tier === 'premium' || subscription.tier === 'ultimate' 
                ? 'Unlimited analyses remaining' 
                : `${subscription.analysesRemaining} analyses remaining today`}
            </Text>
          </View>
          
          <View style={styles.uploadContainer}>
            <View style={styles.privacyNotice}>
              <Shield size={20} color="#4CAF50" />
              <Text style={styles.privacyNoticeText}>
                Your face will be automatically masked before AI analysis for privacy protection
              </Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cameraButton]}
                onPress={() => pickImage(true)}
                testID="camera-button"
              >
                <Camera size={20} color="white" />
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.galleryButton]}
                onPress={() => pickImage(false)}
                testID="gallery-button"
              >
                <Upload size={20} color="#1a1a1a" />
                <Text style={[styles.buttonText, styles.galleryButtonText]}>
                  Choose from Gallery
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
                <BlurView intensity={30} style={styles.faceBlurArea}>
                  <PinkGlasses />
                  <View style={styles.faceProtectionInfo}>
                    <Shield size={16} color="white" />
                    <Text style={styles.faceBlurText}>Face Protected</Text>
                  </View>
                </BlurView>
              ) : (
                <View style={styles.faceBlurAreaWeb}>
                  <PinkGlasses />
                  <View style={styles.faceProtectionInfo}>
                    <Shield size={16} color="white" />
                    <Text style={styles.faceBlurText}>Face Protected</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.privacyBadge}>
              <Shield size={14} color="#4CAF50" />
              <Text style={styles.privacyBadgeText}>Privacy Protected</Text>
            </View>
          </View>
          

          
          {showCategorySelection ? (
            <View style={styles.categorySection}>
              <Text style={styles.categoryTitle}>Choose Your Style Category</Text>
              <Text style={styles.categorySubtitle}>
                Select the style you&apos;re aiming for to get a more targeted analysis
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
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'rate') && styles.themedColorDot
                    ]} />
                    <Text style={[
                      styles.categoryLabel,
                      category.id === 'sixties' && styles.sixtiesCategoryLabel,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'rate') && styles.themedCategoryLabel,
                      isDisabled && styles.disabledCategoryLabel
                    ]}>{category.label}{isPremiumFeature && !hasAccess && ' 🔒'}</Text>
                    <Text style={[
                      styles.categoryDescription,
                      category.id === 'sixties' && styles.sixtiesCategoryDescription,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'rate') && styles.themedCategoryDescription,
                      isDisabled && styles.disabledCategoryDescription
                    ]}>{isPremiumFeature && !hasAccess ? 'Premium Feature - Upgrade to unlock' : category.description}</Text>
                    {isPremiumFeature && !hasAccess && (
                      <View style={styles.premiumOverlay}>
                        <Crown size={16} color="#FFD700" />
                        <Text style={styles.premiumOverlayText}>Premium</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  );
                })}
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.resetButton]}
                onPress={resetApp}
              >
                <Text style={[styles.buttonText, styles.resetButtonText]}>
                  Choose Different Photo
                </Text>
              </TouchableOpacity>
            </View>
          ) : showRateOptions ? (
            <View style={styles.rateOptionsSection}>
              <Text style={styles.categoryTitle}>Rate This Outfit</Text>
              <Text style={styles.categorySubtitle}>
                Choose a category to get a targeted analysis, or select general rating
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
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime') && styles.themedColorDot
                    ]} />
                    <Text style={[
                      styles.categoryLabel,
                      category.id === 'sixties' && styles.sixtiesCategoryLabel,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime') && styles.themedCategoryLabel
                    ]}>{category.label}</Text>
                    <Text style={[
                      styles.categoryDescription,
                      category.id === 'sixties' && styles.sixtiesCategoryDescription,
                      (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                       category.id === 'naive' || category.id === 'trendy' || category.id === 'anime') && styles.themedCategoryDescription
                    ]}>{category.description}</Text>
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
                  ]}>All Categories{(subscription.tier === 'free' || subscription.tier === 'basic') && ' 🔒'}</Text>
                  <Text style={[
                    styles.categoryDescription, 
                    styles.themedCategoryDescription,
                    (subscription.tier === 'free' || subscription.tier === 'basic') && styles.disabledCategoryDescription
                  ]}>{(subscription.tier === 'free' || subscription.tier === 'basic') ? 'Premium Feature - Upgrade to unlock' : 'Get results for all 6 categories'}</Text>
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
                  Back to Categories
                </Text>
              </TouchableOpacity>
            </View>
          ) : !analysis ? (
            <View style={styles.actionContainer}>
              <View style={styles.selectedCategoryDisplay}>
                <Text style={styles.selectedCategoryLabel}>Selected Style:</Text>
                <View style={styles.selectedCategoryChip}>
                  <View style={[
                    styles.categoryColorDot,
                    { backgroundColor: STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.color }
                  ]} />
                  <Text style={styles.selectedCategoryText}>
                    {STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.label}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.analyzeButton]}
                onPress={analyzeOutfit}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Sparkles size={20} color="white" />
                )}
                <Text style={styles.buttonText}>
                  {isAnalyzing ? 'Analyzing...' : 'Rate My Outfit'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={selectedCategory === 'rate' ? goBackToRateOptions : goBackToCategories}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  {selectedCategory === 'rate' ? 'Change Rating Category' : 'Change Style Category'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.resetButton]}
                onPress={resetApp}
              >
                <Text style={[styles.buttonText, styles.resetButtonText]}>
                  Choose Different Photo
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.resultsContainer}>
              {selectedCategory === 'rate' && 'results' in analysis ? (
                // All Categories Results
                <>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreTitle}>Overall Style Score</Text>
                    <View style={styles.scoreDisplay}>
                      <Text style={styles.scoreNumber}>{Math.round(analysis.overallScore * 10) / 10}</Text>
                      <Text style={styles.scoreOutOf}>/12</Text>
                    </View>
                    <View style={styles.starsContainer}>
                      {renderScoreStars(analysis.overallScore)}
                    </View>
                  </View>
                  
                  <View style={styles.analysisContainer}>
                    <View style={styles.selectedCategoryResultDisplay}>
                      <Text style={styles.analysisLabel}>Analysis Type:</Text>
                      <View style={styles.selectedCategoryChip}>
                        <View style={[
                          styles.categoryColorDot,
                          { backgroundColor: STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.color }
                        ]} />
                        <Text style={styles.selectedCategoryText}>
                          All Categories (6 Results)
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={styles.analysisLabel}>Overall Analysis</Text>
                      <Text style={styles.analysisText}>{analysis.overallAnalysis}</Text>
                    </View>
                    
                    <View style={styles.allCategoriesResults}>
                      <Text style={styles.allCategoriesTitle}>Category Breakdown - 6 Separate Results</Text>
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
                                <View style={styles.categoryResultChip}>
                                  <View style={[
                                    styles.categoryColorDot,
                                    { backgroundColor: categoryInfo?.color || '#999' }
                                  ]} />
                                  <Text style={styles.categoryResultName}>
                                    {categoryInfo?.label || (result.category ? result.category.charAt(0).toUpperCase() + result.category.slice(1) : 'Unknown')}
                                  </Text>
                                </View>
                                <View style={styles.categoryResultScore}>
                                  <View style={styles.scoreRow}>
                                    <Text style={styles.categoryScoreNumber}>{result.score || 0}</Text>
                                    <Text style={styles.categoryScoreOutOf}>/12</Text>
                                  </View>
                                  <View style={styles.categoryStars}>
                                    {renderScoreStars(result.score || 0).slice(0, 5)}
                                  </View>
                                </View>
                              </View>
                              <Text style={styles.categoryResultAnalysis}>{result.analysis || 'No analysis available'}</Text>
                              <View style={styles.categorySuggestions}>
                                <Text style={styles.suggestionsSubtitle}>Suggestions for {categoryInfo?.label || result.category || 'this category'}:</Text>
                                {result.suggestions && Array.isArray(result.suggestions) ? result.suggestions.map((suggestion, suggestionIndex) => (
                                  <View key={suggestionIndex} style={styles.suggestionItem}>
                                    <View style={styles.suggestionBullet} />
                                    <Text style={styles.suggestionText}>{suggestion}</Text>
                                  </View>
                                )) : (
                                  <View style={styles.suggestionItem}>
                                    <View style={styles.suggestionBullet} />
                                    <Text style={styles.suggestionText}>No suggestions available</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        }).filter(Boolean)
                      ) : (
                        <View style={styles.noResultsContainer}>
                          <Text style={styles.noResultsText}>No category results available</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                // Single Category Results
                <>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreTitle}>Your Style Score</Text>
                    <View style={styles.scoreDisplay}>
                      <Text style={styles.scoreNumber}>{(analysis as OutfitAnalysis).score}</Text>
                      <Text style={styles.scoreOutOf}>/12</Text>
                    </View>
                    <View style={styles.starsContainer}>
                      {renderScoreStars((analysis as OutfitAnalysis).score)}
                    </View>
                  </View>
                  
                  <View style={styles.analysisContainer}>
                    <View style={styles.selectedCategoryResultDisplay}>
                      <Text style={styles.analysisLabel}>Analyzed for Style:</Text>
                      <View style={styles.selectedCategoryChip}>
                        <View style={[
                          styles.categoryColorDot,
                          { backgroundColor: STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.color }
                        ]} />
                        <Text style={styles.selectedCategoryText}>
                          {STYLE_CATEGORIES.find(cat => cat.id === selectedCategory)?.label}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={styles.analysisLabel}>Style Analysis</Text>
                      <Text style={styles.analysisText}>{(analysis as OutfitAnalysis).style}</Text>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={styles.analysisLabel}>Color Coordination</Text>
                      <Text style={styles.analysisText}>{(analysis as OutfitAnalysis).colorCoordination}</Text>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={styles.analysisLabel}>Accessories</Text>
                      <Text style={styles.analysisText}>{(analysis as OutfitAnalysis).accessories}</Text>
                    </View>
                    
                    <View style={styles.analysisItem}>
                      <Text style={styles.analysisLabel}>Overall Harmony</Text>
                      <Text style={styles.analysisText}>{(analysis as OutfitAnalysis).harmony}</Text>
                    </View>
                    
                    <View style={styles.suggestionsSection}>
                      <View style={styles.suggestionsHeader}>
                        <Lightbulb size={20} color="#FFD700" />
                        <Text style={styles.suggestionsTitle}>Improvement Suggestions</Text>
                      </View>
                      {(analysis as OutfitAnalysis).suggestions?.map((suggestion, index) => (
                        <View key={index} style={styles.suggestionItem}>
                          <View style={styles.suggestionBullet} />
                          <Text style={styles.suggestionText}>{suggestion}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}
              
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.newPhotoButton]}
                  onPress={resetApp}
                >
                  <Upload size={20} color="white" />
                  <Text style={styles.buttonText}>New Photo</Text>
                </TouchableOpacity>
              </View>
              
              {/* Style Category Selection Below Rate Another Outfit Button */}
              <View style={styles.styleCategorySection}>
                <Text style={styles.styleCategoryTitle}>Choose Different Style Category</Text>
                <Text style={styles.styleCategorySubtitle}>
                  Rate this same outfit with a different style category
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
                        category.id === 'rate' && styles.rateCategoryCard
                      ]}
                      onPress={() => {
                        if (category.id === 'rate' && (subscription.tier === 'free' || subscription.tier === 'basic')) {
                          Alert.alert(
                            'Premium Feature',
                            'The "All Categories" analysis is available for Premium and Ultimate subscribers only. Upgrade now to analyze your outfit across all 6 style categories!',
                            [
                              { text: 'Maybe Later', style: 'cancel' },
                              { 
                                text: 'Upgrade Now', 
                                onPress: () => router.push('/subscription')
                              }
                            ]
                          );
                          return;
                        }
                        setSelectedCategory(category.id);
                        setAnalysis(null);
                        analyzeOutfit();
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
                         category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'rate') && styles.themedColorDot
                      ]} />
                      <Text style={[
                        styles.categoryLabel,
                        styles.compactCategoryLabel,
                        category.id === 'sixties' && styles.sixtiesCategoryLabel,
                        (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                         category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'rate') && styles.themedCategoryLabel
                      ]}>{category.label}</Text>
                      <Text style={[
                        styles.categoryDescription,
                        styles.compactCategoryDescription,
                        category.id === 'sixties' && styles.sixtiesCategoryDescription,
                        (category.id === 'sexy' || category.id === 'elegant' || category.id === 'casual' || 
                         category.id === 'naive' || category.id === 'trendy' || category.id === 'anime' || category.id === 'rate') && styles.themedCategoryDescription
                      ]}>{category.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      )}
      </ScrollView>
      
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
    resizeMode: 'cover',
    zIndex: 0,
    transition: 'opacity 0.3s ease',
  },
  touchableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0.5,
  },
  touchableContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flowerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  scrollContainer: {
    flex: 1,
    zIndex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  headerBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.3,
    resizeMode: 'cover',
  },
  headerTitleGradient: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
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
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 6,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  uploadSection: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  uploadContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  buttonContainer: {
    marginTop: 16,
    gap: 12,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  cameraButton: {
    backgroundColor: '#FF69B4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  galleryButton: {
    backgroundColor: 'rgba(255, 182, 193, 0.8)',
    borderWidth: 2,
    borderColor: '#FFB6C1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    fontWeight: '600',
    color: 'white',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 6,
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 10,
    width: '48%',
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
    textAlign: 'center',
    paddingHorizontal: 4,
    lineHeight: 14,
    flexWrap: 'wrap',
  },
  categoryDescription: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    lineHeight: 11,
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
  // Header styles
  headerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerTitleSection: {
    alignItems: 'center',
    width: '100%',
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.25,
    borderRadius: 14,
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
  headerButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  subscriptionBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  
  // Subscription status card
  subscriptionStatusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  subscriptionStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  subscriptionStatusText: {
    fontSize: 14,
    color: '#666',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryResultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 32,
    marginBottom: 20,
    minHeight: 400,
    width: '100%',
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  categoryResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    minHeight: 100,
    width: '100%',
  },
  categoryResultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 182, 193, 0.3)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    gap: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 105, 180, 0.4)',
    flex: 1,
    marginRight: 20,
    minHeight: 70,
    maxWidth: '75%',
  },
  categoryResultName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    flexShrink: 1,
    lineHeight: 26,
    textAlign: 'left',
    flexWrap: 'wrap',
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    lineHeight: 36,
  },
  categoryScoreOutOf: {
    fontSize: 18,
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
    paddingHorizontal: 6,
    textAlign: 'left',
    width: '100%',
    flexWrap: 'wrap',
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