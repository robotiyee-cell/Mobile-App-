import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ShieldCheck, FileText } from 'lucide-react-native';
import { useLanguage } from '../contexts/LanguageContext';

export default function TermsScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const bullets = useMemo(() => t('prohibitedActivitiesBullets')?.split('\n') ?? [], [t]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t('termsTitle') }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="terms-scroll">
        <View style={styles.header}>
          <ShieldCheck size={36} color="#fff" />
          <Text style={styles.headerTitle}>{t('termsTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('termsIntro')}</Text>
        </View>

        <View style={styles.card} testID="terms-copyright">
          <View style={styles.cardHeader}>
            <FileText size={22} color="#FF69B4" />
            <Text style={styles.cardTitle}>{t('copyrightNoticeTitle')}</Text>
          </View>
          <Text style={styles.paragraph}>{t('copyrightNotice')}</Text>
          <Text style={styles.paragraph}>
            All content, UI design, and brand identity of Look 4 Fun are protected under copyright law. Look 4 Fun is an original mobile product. The name and visual identity are protected.
          </Text>
        </View>

        <View style={styles.card} testID="terms-use">
          <Text style={styles.sectionTitle}>{t('termsOfUseTitle')}</Text>
          <Text style={styles.paragraphTitle}>{t('copyrightProtectionTitle')}</Text>
          <Text style={styles.paragraph}>{t('copyrightProtectionText')}</Text>

          <Text style={styles.paragraphTitle}>{t('prohibitedActivitiesTitle')}</Text>
          {bullets.map((b, i) => (
            <Text key={i} style={styles.bullet}>{b}</Text>
          ))}

          <Text style={styles.paragraphTitle}>{t('privacyAndDataTitle')}</Text>
          <Text style={styles.paragraph}>{t('privacyAndDataText')}</Text>

          <Text style={styles.paragraphTitle}>{t('intellectualPropertyTitle')}</Text>
          <Text style={styles.paragraph}>{t('intellectualPropertyText')}</Text>

          <Text style={styles.paragraphTitle}>{t('violationsTitle')}</Text>
          <Text style={styles.paragraph}>{t('violationsText')}</Text>

          <Text style={styles.paragraphTitle}>{t('contactTitle')}</Text>
          <Text style={styles.paragraph}>{t('contactText')}</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            try {
              router.back();
            } catch (e) {
              console.log('navigate back failed', e);
              Alert.alert(t('error') ?? 'Error');
            }
          }}
          style={styles.primaryBtn}
          testID="terms-back-btn"
        >
          <Text style={styles.primaryBtnText}>{t('back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE4E6',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#FF69B4',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  paragraphTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  paragraph: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  bullet: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  primaryBtn: {
    marginTop: 24,
    alignSelf: 'center',
    backgroundColor: '#FF1493',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
