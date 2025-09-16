import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Star, Sparkles, ArrowLeft, Crown, Heart, Coffee, Flower, Zap, Gamepad2, Music } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

interface CategoryResult {
  category: string;
  score: number;
  analysis: string;
  suggestions: string[];
}



const DEMO_IMAGE_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/xp590699iiau76dilxlvz';

const INDIVIDUAL_CATEGORY_ANALYSES: { [key: string]: CategoryResult } = {
  sexy: {
    category: 'sexy',
    score: 8.5,
    analysis: 'The burgundy crop top with floral neckline creates an alluring silhouette that balances sophistication with sensuality. The fitted cut accentuates the waist beautifully, while the rich color adds depth and mystery.',
    suggestions: ['Add statement jewelry to enhance the neckline', 'Consider darker lipstick for more drama', 'Pair with high heels to elongate the silhouette']
  },
  elegant: {
    category: 'elegant',
    score: 9.2,
    analysis: 'This outfit exudes refined elegance with its rich burgundy color palette and delicate floral detailing. The sophisticated cut and quality fabric choice demonstrate excellent taste and timeless style.',
    suggestions: ['Perfect as is for elegant occasions', 'Could pair with pearl accessories for formal events', 'Add a structured blazer for business elegance']
  },
  casual: {
    category: 'casual',
    score: 6.8,
    analysis: 'While beautiful, this outfit leans more formal than casual. The crop top style and rich fabric make it suitable for dressy casual occasions rather than everyday wear.',
    suggestions: ['Layer with a denim jacket for casual styling', 'Pair with sneakers to dress it down', 'Add a crossbody bag for relaxed vibes']
  },
  naive: {
    category: 'naive',
    score: 7.5,
    analysis: 'The floral pattern and soft styling create a sweet, innocent charm. The modest crop length maintains a youthful, approachable aesthetic that feels fresh and playful.',
    suggestions: ['Add a cardigan for extra sweetness', 'Consider pastel accessories to enhance the innocent vibe', 'Style with ballet flats for a youthful look']
  },
  trendy: {
    category: 'trendy',
    score: 8.8,
    analysis: 'This outfit perfectly captures current fashion trends with the crop top silhouette and rich burgundy tone. The floral detailing adds a contemporary romantic touch that\'s very on-trend.',
    suggestions: ['Add layered necklaces for extra trend appeal', 'Consider matching burgundy accessories', 'Style with chunky sneakers for street style edge']
  },
  anime: {
    category: 'anime',
    score: 6.2,
    analysis: 'While the floral elements have some kawaii appeal, the sophisticated color palette and mature styling lean away from typical anime fashion aesthetics. The look is too refined for classic anime style.',
    suggestions: ['Add colorful hair accessories', 'Consider brighter, more playful colors for anime style', 'Include cute character accessories or pins']
  }
};

const STYLE_CATEGORIES_MAIN = [
  { id: 'sexy', label: 'Sexy', color: '#FF6B6B' },
  { id: 'elegant', label: 'Elegant', color: '#4ECDC4' },
  { id: 'casual', label: 'Casual', color: '#45B7D1' },
  { id: 'naive', label: 'Naive', color: '#FFA07A' },
  { id: 'trendy', label: 'Trendy', color: '#98D8C8' },
  { id: 'anime', label: 'Anime', color: '#FF69B4' }
];



export default function DemoScreen() {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const currentAnalysis = selectedCategory === 'all' ? null : INDIVIDUAL_CATEGORY_ANALYSES[selectedCategory];
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

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'sexy': return <Heart size={20} color="white" />;
      case 'elegant': return <Crown size={20} color="white" />;
      case 'casual': return <Coffee size={20} color="white" />;
      case 'naive': return <Flower size={20} color="white" />;
      case 'trendy': return <Zap size={20} color="white" />;
      case 'anime': return <Gamepad2 size={20} color="white" />;
      case 'sixties': return <Music size={20} color="white" />;
      default: return <Star size={20} color="white" />;
    }
  };

  const getCategoryGradient = (categoryId: string): [string, string, string] => {
    switch (categoryId) {
      case 'sexy': return ['#FF6B6B', '#FF1744', '#D50000'];
      case 'elegant': return ['#4ECDC4', '#26A69A', '#00695C'];
      case 'casual': return ['#45B7D1', '#2196F3', '#1565C0'];
      case 'naive': return ['#FFA07A', '#FFB74D', '#FF8A65'];
      case 'trendy': return ['#98D8C8', '#4DB6AC', '#26A69A'];
      case 'anime': return ['#FF69B4', '#E91E63', '#C2185B'];
      case 'sixties': return ['#9B59B6', '#8E44AD', '#6A1B9A'];
      default: return ['#FFD700', '#FFA500', '#FF8C00'];
    }
  };

  const FlowerBackground = () => {
    if (Platform.OS === 'web') {
      // Web-compatible CSS background pattern
      return (
        <View style={styles.flowerBackgroundWeb} />
      );
    }
    
    // For mobile, we can use a simple gradient background instead of complex SVG
    return (
      <LinearGradient
        colors={['#FFE4E6', '#FFF0F5', '#FFE4E6']}
        style={styles.flowerBackground}
      />
    );
  };

  return (
    <View style={styles.container}>
      <FlowerBackground />
      
      {/* Header */}
      <LinearGradient
        colors={['#FF69B4', '#FFB6C1', '#FFC0CB']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Sparkles size={32} color="#FFD700" />
            <View>
              <LinearGradient
                colors={['#FF69B4', '#9B59B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerTitleGradient}
              >
                <Text style={styles.headerTitle}>Demo Result 🌸</Text>
              </LinearGradient>
              <Text style={styles.headerDescription}>AI Fashion Analysis Demo</Text>
            </View>
          </View>
          
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {/* Image Section */}
        <View style={styles.imageSection}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: DEMO_IMAGE_URL }} style={styles.image} />
            <View style={styles.demoOverlay}>
              <View style={styles.demoBadge}>
                <Sparkles size={16} color="#FFD700" />
                <Text style={styles.demoBadgeText}>Demo Analysis</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Category Selection */}
        <View style={styles.categorySelectionContainer}>
          <Text style={styles.categorySelectionTitle}>Select Style Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScrollContainer}>
            {/* All Categories Option */}
            <TouchableOpacity
              key="all"
              style={[
                styles.categoryButton,
                selectedCategory === 'all' && styles.categoryButtonSelected
              ]}
              onPress={() => {
                console.log('All Categories button pressed, current state:', selectedCategory);
                setSelectedCategory('all');
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={selectedCategory === 'all' ? ['#FFD700', '#FFA500', '#FF8C00'] : ['transparent', 'transparent']}
                style={styles.categoryButtonGradient}
              />
              <View style={styles.categoryButtonContent}>
                <Star size={20} color={selectedCategory === 'all' ? "white" : "#666"} />
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategory === 'all' && styles.categoryButtonTextSelected
                ]}>
                  All Categories
                </Text>
              </View>
            </TouchableOpacity>
            
            {STYLE_CATEGORIES_MAIN.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.id && styles.categoryButtonSelected
                ]}
                onPress={() => {
                  console.log(`${category.label} button pressed, current state:`, selectedCategory);
                  setSelectedCategory(category.id);
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={selectedCategory === category.id ? getCategoryGradient(category.id) : ['transparent', 'transparent']}
                  style={styles.categoryButtonGradient}
                />
                <View style={styles.categoryButtonContent}>
                  {getCategoryIcon(category.id)}
                  <Text style={[
                    styles.categoryButtonText,
                    selectedCategory === category.id && styles.categoryButtonTextSelected
                  ]}>
                    {category.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results Container */}
        <View style={styles.resultsContainer}>
          {selectedCategory === 'all' ? (
            /* All Categories Results */
            <View style={styles.allCategoriesContainer}>
              <Text style={styles.allCategoriesTitle}>Complete Style Analysis</Text>
              <Text style={styles.allCategoriesSubtitle}>Results for all 6 style categories</Text>
              
              {STYLE_CATEGORIES_MAIN.map((category) => {
                const categoryAnalysis = INDIVIDUAL_CATEGORY_ANALYSES[category.id];
                return (
                  <View key={category.id} style={styles.categoryResultCard}>
                    <LinearGradient
                      colors={getCategoryGradient(category.id)}
                      style={styles.categoryCardGradient}
                    />
                    
                    <View style={styles.categoryCardHeader}>
                      <View style={styles.categoryCardIconContainer}>
                        {getCategoryIcon(category.id)}
                      </View>
                      <View style={styles.categoryCardTitleContainer}>
                        <Text style={styles.categoryCardTitle}>{category.label}</Text>
                        <View style={styles.categoryCardScoreContainer}>
                          <View style={styles.categoryCardScoreRow}>
                            <Text style={styles.categoryCardScore}>{categoryAnalysis.score}</Text>
                            <Text style={styles.categoryCardScoreOutOf}>/12</Text>
                          </View>
                          <View style={styles.categoryCardStars}>
                            {renderScoreStars(categoryAnalysis.score)}
                          </View>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.categoryCardContent}>
                      <Text style={styles.categoryCardAnalysisTitle}>Analysis</Text>
                      <Text style={styles.categoryCardAnalysisText}>{categoryAnalysis.analysis}</Text>
                      
                      <Text style={styles.categoryCardSuggestionsTitle}>Suggestions</Text>
                      {categoryAnalysis.suggestions.slice(0, 2).map((suggestion, index) => (
                        <View key={index} style={styles.categoryCardSuggestionItem}>
                          <View style={styles.categoryCardSuggestionBullet} />
                          <Text style={styles.categoryCardSuggestionText}>{suggestion}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            /* Single Category Results */
            <>
              {/* Category Score */}
              <View style={styles.scoreContainer}>
                <LinearGradient
                  colors={getCategoryGradient(selectedCategory)}
                  style={styles.scoreBackgroundGradient}
                />
                <View style={styles.categoryIconContainer}>
                  {getCategoryIcon(selectedCategory)}
                </View>
                <Text style={styles.scoreTitle}>{STYLE_CATEGORIES_MAIN.find(cat => cat.id === selectedCategory)?.label} Style Score</Text>
                <View style={styles.scoreDisplay}>
                  <Text style={styles.scoreNumber}>{currentAnalysis?.score}</Text>
                  <Text style={styles.scoreOutOf}>/12</Text>
                </View>
                <View style={styles.starsContainer}>
                  {currentAnalysis && renderScoreStars(currentAnalysis.score)}
                </View>
              </View>
              
              {/* Analysis Container */}
              <View style={styles.analysisContainer}>
                <View style={styles.selectedCategoryResultDisplay}>
                  <Text style={styles.analysisLabel}>Analysis Type:</Text>
                  <View style={styles.selectedCategoryChip}>
                    <View style={[styles.categoryColorDot, { backgroundColor: STYLE_CATEGORIES_MAIN.find(cat => cat.id === selectedCategory)?.color }]} />
                    <Text style={styles.selectedCategoryText}>
                      {STYLE_CATEGORIES_MAIN.find(cat => cat.id === selectedCategory)?.label} Category
                    </Text>
                  </View>
                </View>
                
                <View style={styles.analysisItem}>
                  <Text style={styles.analysisLabel}>Detailed Analysis</Text>
                  <Text style={styles.analysisText}>{currentAnalysis?.analysis}</Text>
                </View>
                
                {/* Suggestions */}
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>Style Suggestions</Text>
                  {currentAnalysis?.suggestions.map((suggestion, index) => (
                    <View key={index} style={styles.suggestionItem}>
                      <View style={styles.suggestionBullet} />
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.tryAppButton]}
            onPress={() => router.replace('/')}
          >
            <Sparkles size={20} color="white" />
            <Text style={styles.buttonText}>Try the App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Copyright Notice */}
      <View style={styles.copyrightContainer}>
        <Text style={styles.copyrightText}>
          Copyright (©) 2024 Look4Fun
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
  flowerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  flowerBackgroundWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    backgroundColor: '#FFE4E6',
    backgroundImage: Platform.select({
      web: `
        radial-gradient(circle at 20% 20%, rgba(155, 89, 182, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 30%, rgba(220, 20, 60, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 10% 60%, rgba(255, 105, 180, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 90% 70%, rgba(135, 206, 235, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 30% 90%, rgba(255, 215, 0, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 70% 85%, rgba(147, 112, 219, 0.1) 0%, transparent 50%)
      `,
      default: undefined,
    }),
  },
  scrollContainer: {
    flex: 1,
    zIndex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: 'relative',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerRight: {
    width: 40, // Same width as back button for centering
  },
  headerTitleGradient: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF1493',
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
  headerDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
    fontStyle: 'italic',
    textAlign: 'center',
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
  demoOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  demoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  resultsContainer: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
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
  selectedCategoryResultDisplay: {
    marginBottom: 20,
    alignItems: 'center',
  },
  analysisLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
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
  categoryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  analysisItem: {
    marginBottom: 20,
  },
  analysisText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },

  categorySelectionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  categorySelectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryScrollContainer: {
    paddingHorizontal: 8,
    gap: 12,
  },
  categoryButton: {
    minWidth: 140,
    height: 90,
    borderRadius: 16,
    marginHorizontal: 4,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(255, 182, 193, 0.3)',
  },
  categoryButtonSelected: {
    borderColor: '#FF69B4',
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  categoryButtonGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3,
  },
  categoryButtonContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
    flexWrap: 'wrap',
  },
  categoryButtonTextSelected: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
  scoreBackgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    borderRadius: 20,
  },
  suggestionsContainer: {
    marginTop: 24,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  categoryIconContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 24,
    padding: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  suggestionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
    marginTop: 6,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
    paddingRight: 12,
  },
  actionButtonsContainer: {
    padding: 24,
    paddingTop: 0,
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
  tryAppButton: {
    backgroundColor: '#FF1493',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
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
  
  // All Categories Styles
  allCategoriesContainer: {
    gap: 20,
  },
  allCategoriesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  allCategoriesSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  categoryResultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
    minHeight: 420,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
  },
  categoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    gap: 20,
    minHeight: 140,
    width: '100%',
  },
  categoryCardIconContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 18,
    padding: 16,
    alignSelf: 'flex-start',
  },
  categoryCardTitleContainer: {
    flex: 1,
    paddingRight: 8,
    minWidth: 0,
    width: '100%',
  },
  categoryCardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    lineHeight: 32,
    flexWrap: 'wrap',
    width: '100%',
  },
  categoryCardScoreContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
  },
  categoryCardScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  categoryCardScore: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  categoryCardScoreOutOf: {
    fontSize: 22,
    fontWeight: '600',
    color: '#999',
    marginLeft: 4,
  },
  categoryCardStars: {
    flexDirection: 'row',
    gap: 2,
  },
  categoryCardContent: {
    gap: 20,
    paddingHorizontal: 0,
    width: '100%',
  },
  categoryCardAnalysisTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    width: '100%',
  },
  categoryCardAnalysisText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 16,
    paddingRight: 0,
    flexWrap: 'wrap',
    width: '100%',
  },
  categoryCardSuggestionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    width: '100%',
  },
  categoryCardSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  categoryCardSuggestionBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD700',
    marginTop: 6,
  },
  categoryCardSuggestionText: {
    flex: 1,
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    paddingRight: 0,
    flexWrap: 'wrap',
    width: '100%',
  },
});