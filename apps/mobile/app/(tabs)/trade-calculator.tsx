import type { TradeInput } from '@apex-tradebill/types';
import { formatCurrency, formatPercent } from '@apex-tradebill/utils';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HistoryList } from '@/src/features/history/HistoryList';
import { useMarketStream } from '@/src/features/stream/useMarketStream';
import { createRefreshScheduler } from '@/src/features/stream/refreshScheduler';
import { RiskVisualization } from '@/src/features/visualization/RiskVisualization';
import {
  selectCalculatorInput,
  selectCalculatorStatus,
  useTradeCalculatorStore,
} from '@/src/state/tradeCalculatorStore';
import { selectFreshnessThreshold, selectRiskConfig, useSettingsStore } from '@/src/state/settingsStore';
import { createApiClient } from '@/src/services/apiClient';

const apiClient = createApiClient();

export default function TradeCalculatorScreen() {
  const input = useTradeCalculatorStore(selectCalculatorInput);
  const output = useTradeCalculatorStore((state) => state.output);
  const warnings = useTradeCalculatorStore((state) => state.warnings);
  const lastUpdatedAt = useTradeCalculatorStore((state) => state.lastUpdatedAt);
  const status = useTradeCalculatorStore(selectCalculatorStatus);
  const setInput = useTradeCalculatorStore((state) => state.setInput);
  const setOutput = useTradeCalculatorStore((state) => state.setOutput);
  const setStatus = useTradeCalculatorStore((state) => state.setStatus);
  const riskKey = useSettingsStore(selectRiskConfig);
  const settingsRiskPercent = riskKey.split(':')[0];
  const settingsAtrMultiplier = riskKey.split(':')[1];
  const defaultTimeframe = useSettingsStore((state) => state.defaultTimeframe);
  const defaultSymbol = useSettingsStore((state) => state.defaultSymbol);
  const freshnessThreshold = useSettingsStore(selectFreshnessThreshold);

  const refreshScheduler = useMemo(
    () =>
      createRefreshScheduler({
        telemetry: {
          onLagDetected: () => setStatus('error', 'Refresh loop lag detected'),
        },
      }),
    [setStatus],
  );

  useEffect(() => {
    refreshScheduler.start();
    return () => refreshScheduler.stop();
  }, [refreshScheduler]);

  const marketStream = useMarketStream({
    symbols: [input.symbol],
    staleThresholdMs: freshnessThreshold,
    onSnapshot: (snapshot) => {
      if (input.useVolatilityStop && !input.entryPrice) {
        setInput({ entryPrice: snapshot.lastPrice });
      }
      refreshScheduler.recordHeartbeat();
    },
  });

  const historyQuery = useInfiniteQuery({
    queryKey: ['tradeHistory'],
    queryFn: ({ pageParam }) => apiClient.getTradeHistory({ cursor: pageParam ?? undefined }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const historyItems = historyQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const { riskPercent: inputRisk, atrMultiplier: inputAtr, timeframe: inputTimeframe, symbol: inputSymbol } = input;

  useEffect(() => {
    if (
      inputRisk !== settingsRiskPercent ||
      inputAtr !== settingsAtrMultiplier ||
      inputTimeframe !== defaultTimeframe ||
      inputSymbol !== defaultSymbol
    ) {
      setInput({
        riskPercent: settingsRiskPercent,
        atrMultiplier: settingsAtrMultiplier,
        timeframe: defaultTimeframe,
        symbol: defaultSymbol,
      });
    }
  }, [
    inputRisk,
    inputAtr,
    inputTimeframe,
    inputSymbol,
    settingsRiskPercent,
    settingsAtrMultiplier,
    defaultTimeframe,
    defaultSymbol,
    setInput,
  ]);

  const previewMutation = useMutation({
    mutationFn: (payload: TradeInput) => apiClient.previewTrade(payload),
    onMutate: () => {
      setStatus('loading');
    },
    onSuccess: (data) => {
      setOutput(data.output, data.warnings, new Date().toISOString());
      setStatus('success');
    },
    onError: (error: Error) => {
      setStatus('error', error.message);
    },
  });

  const handleCalculate = () => {
    previewMutation.mutate({
      ...input,
      riskPercent: settingsRiskPercent,
      atrMultiplier: settingsAtrMultiplier,
    });
  };

  const isLoading = status === 'loading' || previewMutation.isPending;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.symbol}>{input.symbol}</Text>
          <Text style={[styles.badge, marketStream.status === 'stale' ? styles.badgeWarning : styles.badgeSuccess]}>
            {marketStream.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.priceLabel}>Last Price</Text>
        <Text style={styles.priceValue}>{marketStream.snapshot?.lastPrice ?? '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Inputs</Text>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Account Size</Text>
          <TextInput
            value={input.accountSize}
            keyboardType="decimal-pad"
            onChangeText={(value) => setInput({ accountSize: value })}
            style={styles.input}
          />
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Entry Price</Text>
          <TextInput
            value={input.entryPrice ?? ''}
            keyboardType="decimal-pad"
            placeholder={marketStream.snapshot?.lastPrice ?? 'Market'}
            onChangeText={(value) => setInput({ entryPrice: value })}
            style={styles.input}
          />
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Stop Price</Text>
          <TextInput
            value={input.stopPrice}
            keyboardType="decimal-pad"
            onChangeText={(value) => setInput({ stopPrice: value })}
            style={styles.input}
          />
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Target Price</Text>
          <TextInput
            value={input.targetPrice}
            keyboardType="decimal-pad"
            onChangeText={(value) => setInput({ targetPrice: value })}
            style={styles.input}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Use Volatility Stop</Text>
          <Switch
            value={input.useVolatilityStop}
            onValueChange={(value) => setInput({ useVolatilityStop: value })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Direction</Text>
          <View style={styles.toggleGroup}>
            <Pressable
              style={[styles.toggle, input.direction === 'long' && styles.toggleActive]}
              onPress={() => setInput({ direction: 'long' })}
            >
              <Text style={[styles.toggleLabel, input.direction === 'long' && styles.toggleLabelActive]}>Long</Text>
            </Pressable>
            <Pressable
              style={[styles.toggle, input.direction === 'short' && styles.toggleActive]}
              onPress={() => setInput({ direction: 'short' })}
            >
              <Text style={[styles.toggleLabel, input.direction === 'short' && styles.toggleLabelActive]}>Short</Text>
            </Pressable>
          </View>
        </View>
        <Pressable style={styles.calculateButton} onPress={handleCalculate} disabled={isLoading}>
          <Text style={styles.calculateLabel}>{isLoading ? 'Calculating…' : 'Calculate'}</Text>
        </Pressable>
        {status === 'error' ? (
          <Text style={styles.errorText}>Unable to calculate. Adjust inputs and try again.</Text>
        ) : null}
      </View>

      {output ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Outputs</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.outputLabel}>Position Size</Text>
            <Text style={styles.outputValue}>{Number(output.positionSize).toFixed(4)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.outputLabel}>Position Cost</Text>
            <Text style={styles.outputValue}>{formatCurrency(output.positionCost)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.outputLabel}>Risk Amount</Text>
            <Text style={styles.outputValue}>{formatCurrency(output.riskAmount)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.outputLabel}>Risk / Reward</Text>
            <Text style={styles.outputValue}>{output.riskToReward.toFixed(2)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.outputLabel}>Risk Percent</Text>
            <Text style={styles.outputValue}>{formatPercent(Number(settingsRiskPercent))}</Text>
          </View>
          <Text style={styles.timestampLabel}>
            Updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '—'}
          </Text>
          {warnings.length > 0 ? (
            <View style={styles.warningContainer}>
              {warnings.map((warning) => (
                <Text key={warning} style={styles.warningText}>
                  • {warning.replace(/_/g, ' ')}
                </Text>
              ))}
            </View>
          ) : null}
          <RiskVisualization
            direction={input.direction}
            entryPrice={input.entryPrice}
            stopPrice={input.stopPrice}
            targetPrice={input.targetPrice}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Recent History</Text>
          {historyQuery.isFetching ? <ActivityIndicator size="small" /> : null}
        </View>
        <HistoryList
          items={historyItems}
          loading={historyQuery.isFetching && !historyQuery.isFetchingNextPage}
          onRefresh={() => historyQuery.refetch()}
          onLoadMore={() => historyQuery.fetchNextPage()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A12',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  badgeSuccess: {
    backgroundColor: '#16A34A',
  },
  badgeWarning: {
    backgroundColor: '#DC2626',
  },
  priceLabel: {
    color: '#64748B',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  fieldRow: {
    gap: 4,
  },
  label: {
    color: '#475569',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
  toggleActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  toggleLabel: {
    color: '#0F172A',
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: '#FFFFFF',
  },
  calculateButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  calculateLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
  },
  outputLabel: {
    color: '#0F172A',
    fontSize: 14,
  },
  outputValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  timestampLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  warningContainer: {
    gap: 4,
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  warningText: {
    color: '#B45309',
    fontSize: 12,
  },
});
