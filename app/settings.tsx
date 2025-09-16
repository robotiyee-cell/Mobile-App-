import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings as SettingsIcon, Globe, Check, Save } from 'lucide-react-native';
import { useLanguage, Language } from '../contexts/LanguageContext';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  const [saving, setSaving] = useState<boolean>(false);

  const handleLanguageChange = (lang: Language) => {
    setPendingLanguage(lang);
  };

  const languages = useMemo(() => ([
    { code: 'en' as Language, name: t('english'), flag: '🇺🇸', shortCode: 'EN' },
    { code: 'tr' as Language, name: t('turkish'), flag: '🇹🇷', shortCode: 'TR' },
  ]), [t]);

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
        <LinearGradient
          colors={['#FF69B4', '#FFB6C1', '#FFC0CB']}
          style={styles.header}
        >
          <SettingsIcon size={32} color="white" />
          <Text style={styles.headerTitle}>{t('settings')}</Text>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={24} color="#FF69B4" />
            <Text style={styles.sectionTitle}>{t('language')}</Text>
          </View>
          
          <Text style={styles.sectionSubtitle}>{t('selectLanguage')}</Text>
          
          <View style={styles.languageOptions}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={`${lang.code}-${lang.shortCode}`}
                style={[
                  styles.languageOption,
                  pendingLanguage === lang.code && styles.selectedLanguageOption
                ]}
                onPress={() => handleLanguageChange(lang.code)}
                testID={`language-option-${lang.code}`}
              >
                <View style={styles.languageInfo}>
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <View style={styles.languageText}>
                    <Text style={[
                      styles.languageName,
                      pendingLanguage === lang.code && styles.selectedLanguageName
                    ]}>
                      {lang.name}
                    </Text>
                    <Text style={[
                      styles.languageCode,
                      pendingLanguage === lang.code && styles.selectedLanguageCode
                    ]}>
                      {lang.shortCode}
                    </Text>
                  </View>
                </View>
                
                {pendingLanguage === lang.code && (
                  <View style={styles.checkContainer}>
                    <Check size={20} color="#FF69B4" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, styles.commitButton]}
            onPress={async () => {
              try {
                setSaving(true);
                await setLanguage(pendingLanguage);
              } catch (e) {
                console.log('Failed to apply language', e);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || pendingLanguage === language}
            testID="btn-commit-language"
          >
            <Save size={20} color="white" />
            <Text style={styles.buttonText}>{saving ? '...' : t('apply')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.legalButton]}
            onPress={() => {
              try {
                router.push('/terms');
              } catch (e) {
                console.log('navigate terms failed', e);
              }
            }}
            testID="btn-open-terms"
          >
            <Text style={styles.legalText}>{t('termsTitle')}</Text>
          </TouchableOpacity>
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  commitButton: {
    backgroundColor: '#FF1493',
    marginHorizontal: 20,
    marginBottom: 32,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  legalButton: {
    backgroundColor: 'transparent',
    marginTop: 12,
  },
  legalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF1493',
    textDecorationLine: 'underline',
  },
});