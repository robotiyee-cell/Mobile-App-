import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { LinearGradient } from 'expo-linear-gradient';
import { Loader2, Search, CheckCircle2, AlertTriangle, RefreshCw, Link as LinkIcon, ImagePlus, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';

interface DesignMatchExact {
  brand: string;
  designer: string;
  collection?: string;
  season?: string;
  year?: number;
  pieceName?: string;
  confidence?: number;
  evidence?: string;
}

interface DesignMatchTopItem {
  rank: number;
  brand: string;
  designer: string;
  collection?: string;
  season?: string;
  year?: number;
  similarityPercent: number;
  rationale: string;
}

type TrendDirection = "increasing" | "decreasing" | "stable";

interface TrendAnalysis {
  direction: TrendDirection;
  strength: number;
  timeframe: string;
  reasoning: string;
}

interface CategoryResult {
  category: string;
  score: number;
  analysis: string;
  suggestions: string[];
  trendAnalysis?: TrendAnalysis;
}

interface AllCategoriesResult {
  overallScore: number;
  overallAnalysis: string;
  overallTrendAnalysis?: TrendAnalysis;
  results: CategoryResult[];
}

function EvidenceBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const onToggle = useCallback(() => setExpanded((e) => !e), []);
  return (
    <View>
      <Text style={styles.evidence} numberOfLines={expanded ? undefined : 6} testID="evidence-text">
        {text}
      </Text>
      <TouchableOpacity onPress={onToggle} accessibilityRole="button" testID="evidence-toggle">
        <Text style={styles.toggleText}>{expanded ? 'Show less' : 'Show more'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function TrendIndicator({ trend }: { trend: TrendAnalysis }) {
  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'increasing': return <TrendingUp size={16} color="#10B981" />;
      case 'decreasing': return <TrendingDown size={16} color="#EF4444" />;
      case 'stable': return <Minus size={16} color="#6B7280" />;
    }
  };

  const getTrendColor = () => {
    switch (trend.direction) {
      case 'increasing': return '#10B981';
      case 'decreasing': return '#EF4444';
      case 'stable': return '#6B7280';
    }
  };

  const strengthBars = Array.from({ length: 10 }, (_, i) => (
    <View
      key={i}
      style={[
        styles.strengthBar,
        { backgroundColor: i < trend.strength ? getTrendColor() : '#374151' }
      ]}
    />
  ));

  return (
    <View style={styles.trendContainer}>
      <View style={styles.trendHeader}>
        {getTrendIcon()}
        <Text style={[styles.trendDirection, { color: getTrendColor() }]}>
          {trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}
        </Text>
        <Text style={styles.trendTimeframe}>({trend.timeframe})</Text>
      </View>
      <View style={styles.strengthContainer}>
        <Text style={styles.strengthLabel}>Strength: {trend.strength}/10</Text>
        <View style={styles.strengthBars}>{strengthBars}</View>
      </View>
      <Text style={styles.trendReasoning}>{trend.reasoning}</Text>
    </View>
  );
}

function CategoryResultItem({ item }: { item: CategoryResult }) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const onToggle = useCallback(() => setExpanded((e) => !e), []);

  return (
    <View style={styles.categoryItem}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryName}>{item.category}</Text>
        <Text style={styles.categoryScore}>{item.score}/12</Text>
      </View>
      <TouchableOpacity onPress={onToggle} accessibilityRole="button">
        <Text style={styles.categoryAnalysis} numberOfLines={expanded ? undefined : 2}>
          {item.analysis}
        </Text>
        <Text style={styles.toggleText}>{expanded ? 'Show less' : 'Show more'}</Text>
      </TouchableOpacity>
      {item.trendAnalysis && (
        <TrendIndicator trend={item.trendAnalysis} />
      )}
      {item.suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsLabel}>Suggestions:</Text>
          {item.suggestions.map((suggestion, idx) => (
            <Text key={idx} style={styles.suggestionText}>• {suggestion}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function SuggestionItem({ item }: { item: DesignMatchTopItem }) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const onToggle = useCallback(() => setExpanded((e) => !e), []);

  return (
    <View style={styles.suggestionRow} testID={`suggestion-${item.rank}`}>
      <Text style={styles.suggestionRank}>{item.rank}.</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.suggestionMain} testID={`suggestion-main-${item.rank}`}>{item.brand} — {item.designer}</Text>
        <TouchableOpacity onPress={onToggle} accessibilityRole="button" testID={`suggestion-toggle-${item.rank}`}>
          <Text
            style={styles.suggestionMeta}
            numberOfLines={expanded ? undefined : 3}
          >
            {`${item.similarityPercent}% • ${item.rationale}`}
          </Text>
          <Text style={styles.toggleText}>{expanded ? 'Show less' : 'Show more'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface DesignMatchResult {
  exactMatch: DesignMatchExact;
  topMatches: DesignMatchTopItem[];
}

const DEFAULT_URLS = [
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/j33m3klxqmz07l4tqd57v',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/dqhuvs6z9cfn4njggviv4',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/phxi7o26b1lfib2rfflzf',
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/pgbvy8ozg4vkqp8kkowya',
];

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  if (Platform.OS === 'web') {
    // @ts-ignore
    return btoa(binary);
  }
  // polyfill
  const base64 = globalThis.Buffer ? globalThis.Buffer.from(binary, 'binary').toString('base64') : binary;
  return base64;
}

export default function DesignMatchTest() {
  const [urls, setUrls] = useState<string[]>(DEFAULT_URLS);
  const [running, setRunning] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const startMutation = trpc.analysis.start.useMutation();
  const statusQuery = trpc.analysis.status.useQuery(
    { jobId: jobId ?? '' },
    { enabled: !!jobId, refetchInterval: (q) => (q.state.data?.status === 'processing' ? 1200 : false) as any }
  );

  const result: DesignMatchResult | null = useMemo(() => {
    const r = statusQuery.data?.result as unknown;
    if (r && typeof r === 'object' && (r as any).exactMatch && (r as any).topMatches) return r as DesignMatchResult;
    return null;
  }, [statusQuery.data]);

  const allCategoriesResult: AllCategoriesResult | null = useMemo(() => {
    const r = statusQuery.data?.result as unknown;
    if (r && typeof r === 'object' && (r as any).overallScore && (r as any).results) return r as AllCategoriesResult;
    return null;
  }, [statusQuery.data]);

  const fetchBase64 = useCallback(async (url: string): Promise<string> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('download_failed');
    const buf = await res.arrayBuffer();
    return arrayBufferToBase64(buf);
  }, []);

  const onRun = useCallback(async () => {
    setError(null);
    setRunning(true);
    try {
      const filtered = urls.map((u) => u.trim()).filter((u) => u.length > 6).slice(0, 4);
      if (filtered.length === 0) throw new Error('no_urls');
      const base64s: string[] = await Promise.all(filtered.map((u) => fetchBase64(u)));
      const resp = await startMutation.mutateAsync({ imageBase64s: base64s, category: 'designMatch', language: 'en', plan: 'premium' });
      setJobId(resp.jobId);
    } catch (e: any) {
      setError(e?.message ?? 'unknown_error');
      setRunning(false);
    }
  }, [urls, startMutation, fetchBase64]);

  const onRunWithCategory = useCallback(async (category: string) => {
    setError(null);
    setRunning(true);
    try {
      const filtered = urls.map((u) => u.trim()).filter((u) => u.length > 6).slice(0, 4);
      if (filtered.length === 0) throw new Error('no_urls');
      const base64s: string[] = await Promise.all(filtered.map((u) => fetchBase64(u)));
      const resp = await startMutation.mutateAsync({ imageBase64s: base64s, category, language: 'en', plan: 'premium' });
      setJobId(resp.jobId);
    } catch (e: any) {
      setError(e?.message ?? 'unknown_error');
      setRunning(false);
    }
  }, [urls, startMutation, fetchBase64]);

  useEffect(() => {
    if (statusQuery.data?.status === 'succeeded' || statusQuery.data?.status === 'failed') {
      setRunning(false);
    }
  }, [statusQuery.data?.status]);

  return (
    <View style={styles.container} testID="designMatchTest">
      <Stack.Screen options={{ title: 'Design Match Test' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Input images (up to 4 URLs)</Text>
        {urls.map((u, idx) => (
          <View key={idx} style={styles.urlRow}>
            <LinkIcon size={18} color="#666" />
            <TextInput
              value={u}
              onChangeText={(t) => {
                const copy = [...urls];
                copy[idx] = t;
                setUrls(copy);
              }}
              placeholder={`Image URL ${idx + 1}`}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              testID={`url-${idx}`}
            />
          </View>
        ))}
        <View style={styles.row}>
          <TouchableOpacity
            onPress={() => setUrls((prev) => (prev.length < 4 ? [...prev, ''] : prev))}
            style={[styles.button, styles.secondary]}
            testID="addUrl"
          >
            <ImagePlus size={18} color="#1a1a1a" />
            <Text style={styles.buttonTextSecondary}>Add URL</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setUrls(DEFAULT_URLS)} style={[styles.button, styles.secondary]}>
            <RefreshCw size={18} color="#1a1a1a" />
            <Text style={styles.buttonTextSecondary}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewGrid}>
          {urls.slice(0, 4).map((u, i) => (
            <Image key={`preview-${i}`} source={{ uri: u }} style={styles.preview} contentFit="cover" />
          ))}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={onRun} disabled={running} style={[styles.button, styles.primary]} testID="runBtn">
            <LinearGradient colors={["#111827", "#0f766e"]} style={styles.gradient} />
            {running ? <Loader2 size={18} color="#fff" /> : <Search size={18} color="#fff" />}
            <Text style={styles.buttonText}>{running ? 'Running…' : 'Run Design Match'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => onRunWithCategory('rate')} 
            disabled={running} 
            style={[styles.button, styles.secondary]} 
            testID="runTrendBtn"
          >
            <TrendingUp size={18} color="#1a1a1a" />
            <Text style={styles.buttonTextSecondary}>Trend Analysis</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBox} testID="errorBox">
            <AlertTriangle size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {statusQuery.data?.status === 'processing' && (
          <Text style={styles.info}>Processing… Job {jobId}</Text>
        )}

        {result && (
          <View style={styles.resultBox} testID="resultBox">
            <View style={styles.resultHeader}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={styles.resultTitle}>Exact Match</Text>
            </View>
            <Text style={styles.resultMain}>{result.exactMatch.brand} — {result.exactMatch.designer}</Text>
            {typeof result.exactMatch.confidence === 'number' && (
              <Text style={styles.resultMeta}>Confidence: {result.exactMatch.confidence}%</Text>
            )}
            {!!result.exactMatch.collection && <Text style={styles.resultMeta}>Collection: {result.exactMatch.collection}</Text>}
            {!!result.exactMatch.season && <Text style={styles.resultMeta}>Season: {result.exactMatch.season}</Text>}
            {!!result.exactMatch.year && <Text style={styles.resultMeta}>Year: {result.exactMatch.year}</Text>}
            {!!result.exactMatch.pieceName && <Text style={styles.resultMeta}>Piece: {result.exactMatch.pieceName}</Text>}
            {!!result.exactMatch.evidence && (
              <EvidenceBlock text={result.exactMatch.evidence} />
            )}

            <Text style={styles.suggestionsTitle}>Closest Suggestions</Text>
            {result.topMatches.slice(0, 5).map((m) => (
              <SuggestionItem key={m.rank} item={m} />
            ))}
          </View>
        )}

        {allCategoriesResult && (
          <View style={styles.resultBox} testID="trendResultBox">
            <View style={styles.resultHeader}>
              <TrendingUp size={20} color="#10B981" />
              <Text style={styles.resultTitle}>Style Analysis with Trends</Text>
            </View>
            <Text style={styles.resultMain}>Overall Score: {allCategoriesResult.overallScore}/12</Text>
            <Text style={styles.overallAnalysis}>{allCategoriesResult.overallAnalysis}</Text>
            
            {allCategoriesResult.overallTrendAnalysis && (
              <View style={styles.overallTrendSection}>
                <Text style={styles.overallTrendTitle}>Overall Fashion Trend</Text>
                <TrendIndicator trend={allCategoriesResult.overallTrendAnalysis} />
              </View>
            )}

            <Text style={styles.categoriesTitle}>Category Breakdown</Text>
            {allCategoriesResult.results.map((category, idx) => (
              <CategoryResultItem key={idx} item={category} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, gap: 12 },
  sectionTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  input: { flex: 1, color: '#F9FAFB', paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, overflow: 'hidden' },
  primary: { backgroundColor: 'transparent' },
  secondary: { backgroundColor: '#F3F4F6' },
  gradient: { ...StyleSheet.absoluteFillObject, borderRadius: 10, opacity: 0.9 },
  buttonText: { color: '#fff', fontWeight: '700' },
  buttonTextSecondary: { color: '#111827', fontWeight: '700' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { width: '48%', aspectRatio: 3/4, borderRadius: 10, backgroundColor: '#111827' },
  errorBox: { marginTop: 10, backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: '#991B1B' },
  info: { color: '#A7F3D0', marginTop: 8 },
  resultBox: { backgroundColor: '#111827', borderRadius: 12, padding: 14, gap: 8, marginTop: 14 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { color: '#D1FAE5', fontWeight: '800', fontSize: 16 },
  resultMain: { color: '#F9FAFB', fontWeight: '800', fontSize: 18 },
  resultMeta: { color: '#93C5FD' },
  evidence: { color: '#9CA3AF', backgroundColor: '#0B1220', padding: 8, borderRadius: 8 },
  suggestionsTitle: { color: '#E5E7EB', fontWeight: '800', marginTop: 6 },
  suggestionRow: { flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  suggestionRank: { color: '#9CA3AF', width: 22 },
  suggestionMain: { color: '#F9FAFB', fontWeight: '700' },
  suggestionMeta: { color: '#9CA3AF', flexWrap: 'wrap' as const },
  toggleText: { color: '#93C5FD', marginTop: 4, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  trendContainer: { backgroundColor: '#0B1220', borderRadius: 8, padding: 10, marginTop: 8 },
  trendHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  trendDirection: { fontWeight: '700', fontSize: 14 },
  trendTimeframe: { color: '#9CA3AF', fontSize: 12 },
  strengthContainer: { marginBottom: 6 },
  strengthLabel: { color: '#E5E7EB', fontSize: 12, marginBottom: 4 },
  strengthBars: { flexDirection: 'row', gap: 2 },
  strengthBar: { width: 12, height: 4, borderRadius: 2 },
  trendReasoning: { color: '#9CA3AF', fontSize: 12, lineHeight: 16 },
  categoryItem: { backgroundColor: '#1F2937', borderRadius: 8, padding: 12, marginBottom: 8 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  categoryName: { color: '#F9FAFB', fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
  categoryScore: { color: '#10B981', fontWeight: '800', fontSize: 16 },
  categoryAnalysis: { color: '#D1D5DB', lineHeight: 18, marginBottom: 4 },
  suggestionsContainer: { marginTop: 8 },
  suggestionsLabel: { color: '#93C5FD', fontWeight: '700', fontSize: 12, marginBottom: 4 },
  suggestionText: { color: '#9CA3AF', fontSize: 12, marginBottom: 2 },
  overallAnalysis: { color: '#D1D5DB', marginTop: 8, lineHeight: 18 },
  overallTrendSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  overallTrendTitle: { color: '#E5E7EB', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  categoriesTitle: { color: '#E5E7EB', fontWeight: '800', fontSize: 16, marginTop: 16, marginBottom: 8 },
});
