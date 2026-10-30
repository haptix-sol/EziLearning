import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchChallenge, fetchChallenges, fetchHealth } from './src/api/eziApi';
import type { ChallengeSummary } from './src/api/types';
import { getApiBaseUrl } from './src/config/getApiBaseUrl';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
    },
  },
});

function HomeScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  const listQuery = useQuery({
    queryKey: ['challenges'],
    queryFn: fetchChallenges,
  });

  const detailQuery = useQuery({
    queryKey: ['challenge', selectedId],
    queryFn: () => fetchChallenge(selectedId!),
    enabled: Boolean(selectedId),
  });

  const onRefresh = useCallback(() => {
    healthQuery.refetch();
    listQuery.refetch();
    if (selectedId) {
      detailQuery.refetch();
    }
  }, [healthQuery, listQuery, detailQuery, selectedId]);

  const refreshing = healthQuery.isFetching || listQuery.isFetching || detailQuery.isFetching;

  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const renderItem = useCallback(
    ({ item }: { item: ChallengeSummary }) => (
      <Pressable style={styles.card} onPress={() => setSelectedId(item.id)}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.language}
          {item.difficulty ? ` · ${item.difficulty}` : ''}
        </Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
      </Pressable>
    ),
    [],
  );

  if (selectedId) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Pressable style={styles.backBtn} onPress={() => setSelectedId(null)}>
          <Text style={styles.backBtnText}>← Challenges</Text>
        </Pressable>
        {detailQuery.isLoading ? (
          <ActivityIndicator size="large" color={colors.accent} style={styles.centered} />
        ) : detailQuery.error ? (
          <Text style={styles.error}>{String(detailQuery.error.message)}</Text>
        ) : detailQuery.data ? (
          <ScrollView
            refreshControl={<RefreshControl refreshing={detailQuery.isFetching} onRefresh={onRefresh} />}
          >
            <View style={styles.detailWrap}>
              <Text style={styles.detailTitle}>{detailQuery.data.title}</Text>
              <Text style={styles.detailMeta}>
                {detailQuery.data.language}
                {detailQuery.data.difficulty ? ` · ${detailQuery.data.difficulty}` : ''}
              </Text>
              <Text style={styles.detailBody}>{detailQuery.data.description}</Text>
              {detailQuery.data.starter_code ? (
                <View style={styles.codeBlock}>
                  <Text style={styles.codeLabel}>Starter</Text>
                  <Text style={styles.codeText}>{detailQuery.data.starter_code}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Text style={styles.h1}>EziLearning</Text>
      <Text style={styles.sub}>Same backend as the web app · {apiBase}</Text>

      <View style={styles.statusRow}>
        {healthQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : healthQuery.error ? (
          <Text style={styles.error}>Health: {String(healthQuery.error.message)}</Text>
        ) : healthQuery.data ? (
          <Text style={styles.healthOk}>
            API {healthQuery.data.status}
            {healthQuery.data.llm_provider != null ? ` · LLM: ${healthQuery.data.llm_provider}` : ''}
          </Text>
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Coding challenges</Text>
      {listQuery.isLoading && !listQuery.data ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.centered} />
      ) : listQuery.error ? (
        <Text style={styles.error}>{String(listQuery.error.message)}</Text>
      ) : (
        <FlatList
          data={listQuery.data ?? []}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No challenges yet. Seed the backend database.</Text>}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HomeScreen />
    </QueryClientProvider>
  );
}

const colors = {
  bg: '#0f1419',
  card: '#1a2332',
  text: '#e7ecf3',
  muted: '#8b9cb3',
  accent: '#5b9fd4',
  error: '#f07178',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 52,
    paddingHorizontal: 16,
  },
  h1: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 16,
  },
  statusRow: {
    minHeight: 28,
    marginBottom: 12,
  },
  healthOk: {
    color: colors.accent,
    fontSize: 14,
  },
  error: {
    color: colors.error,
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 4,
  },
  cardDesc: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
  },
  centered: {
    marginTop: 40,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingRight: 12,
  },
  backBtnText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  detailWrap: {
    paddingBottom: 40,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  detailMeta: {
    fontSize: 14,
    color: colors.accent,
    marginTop: 6,
  },
  detailBody: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginTop: 16,
  },
  codeBlock: {
    marginTop: 20,
    backgroundColor: '#0d1117',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  codeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  codeText: {
    color: '#c9d1d9',
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
