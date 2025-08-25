import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Globe, Check } from 'lucide-react-native';
import { useLanguage, Language } from '../contexts/LanguageContext';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageChange = async (lang: Language) => {
    await setLanguage(lang);
  };

  const languages = [
    { code: 'en' as Language, name: t('english'), flag: '🇺🇸', shortCode: 'EN' },
    { code: 'tr' as Language, name: t('turkish'), flag: '🇹🇷', shortCode: 'TR' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('settings'),
          headerStyle: { backgroundColor: '#FF69B4' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: 'bold' }
        }} 
      />
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <LinearGradient
          colors={['#FF69B4', '#FFB6C1', '#FFC0CB']}
          style={styles.header}
        >
          <Settings size={32} color="white" />
          <Text style={styles.headerTitle}>{t('settings')}</Text>
        </LinearGradient>

        {/* Language Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={24} color="#FF69B4" />
            <Text style={styles.sectionTitle}>{t('language')}</Text>
          </View>
          
          <Text style={styles.sectionSubtitle}>{t('selectLanguage')}</Text>
          
          <View style={styles.languageOptions}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  language === lang.code && styles.selectedLanguageOption
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <View style={styles.languageInfo}>
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <View style={styles.languageText}>
                    <Text style={[
                      styles.languageName,
                      language === lang.code && styles.selectedLanguageName
                    ]}>
                      {lang.name}
                    </Text>
                    <Text style={[
                      styles.languageCode,
                      language === lang.code && styles.selectedLanguageCode
                    ]}>
                      {lang.shortCode}
                    </Text>
                  </View>
                </View>
                
                {language === lang.code && (
                  <View style={styles.checkContainer}>
                    <Check size={20} color="#FF69B4" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE4E6',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  languageOptions: {
    gap: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 182, 193, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedLanguageOption: {
    backgroundColor: 'rgba(255, 105, 180, 0.2)',
    borderColor: '#FF69B4',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  languageFlag: {
    fontSize: 32,
  },
  languageText: {
    gap: 2,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  selectedLanguageName: {
    color: '#FF1493',
  },
  languageCode: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedLanguageCode: {
    color: '#FF69B4',
  },
  checkContainer: {
    backgroundColor: 'rgba(255, 105, 180, 0.1)',
    borderRadius: 20,
    padding: 8,
  },
});