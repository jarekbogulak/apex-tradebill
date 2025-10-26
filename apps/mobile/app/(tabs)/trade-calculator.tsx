import type { MarketSnapshot, TradeInput } from '@apex-tradebill/types';
import { formatCurrency, formatPercent } from '@apex-tradebill/utils';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { shallow } from 'zustand/shallow';
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
import StaleBanner from '@/src/features/stream/StaleBanner';
import { useMarketStream } from '@/src/features/stream/useMarketStream';
import { createRefreshScheduler } from '@/src/features/stream/refreshScheduler';
import type { RefreshScheduler } from '@/src/features/stream/refreshScheduler';
import { RiskVisualization } from '@/src/features/visualization/RiskVisualization';
import { selectCalculatorInput, selectCalculatorStatus, useTradeCalculatorStore } from '@/src/state/tradeCalculatorStore';
import { selectFreshnessThreshold, selectRiskConfig, useSettingsStore } from '@/src/state/settingsStore';
import { createApiClient } from '@/src/services/apiClient';
import { createCacheSyncWorker } from '@/src/sync/cacheSync';

const apiClient = createApiClient();
const cacheSyncWorker = createCacheSyncWorker();

export default function TradeCalculatorScreen() {
  const input = useTradeCalculatorStore(selectCalculatorInput);
  const output = useTradeCalculatorStore((state) => state.output, shallow);
  const warnings = useTradeCalculatorStore((state) => state.warnings, shallow);
  const lastUpdatedAt = useTradeCalculatorStore((state) => state.lastUpdatedAt);
  const snapshot = useTradeCalculatorStore((state) => state.snapshot);
  const status = useTradeCalculatorStore(selectCalculatorStatus);
  const setInput = useTradeCalculatorStore((state) => state.setInput);
  const setOutput = useTradeCalculatorStore((state) => state.setOutput);
  const setStatus = useTradeCalculatorStore((state) => state.setStatus);
  const hasManualEntry = useTradeCalculatorStore((state) => state.hasManualEntry);
  const setHasManualEntry = useTradeCalculatorStore((state) => state.setHasManualEntry);
  const riskKey = useSettingsStore(selectRiskConfig);
  const settingsRiskPercent = riskKey.split(':')[0];
  const settingsAtrMultiplier = riskKey.split(':')[1];
  const defaultTimeframe = useSettingsStore((state) => state.defaultTimeframe);
  const defaultSymbol = useSettingsStore((state) => state.defaultSymbol);
  const freshnessThreshold = useSettingsStore(selectFreshnessThreshold);
  const latestPriceRef = useRef<string | null>(null);
  const requestSourceRef = useRef<'manual' | 'live'>('manual');
  const livePreviewActiveRef = useRef(false);
  const livePreviewTickRef = useRef<() => void>(() => undefined);
  const isEntryFocusedRef = useRef(false);
  const hasManualEntryRef = useRef(hasManualEntry);
  const refreshSchedulerRef = useRef<RefreshScheduler | null>(null);

  if (!refreshSchedulerRef.current) {
    refreshSchedulerRef.current = createRefreshScheduler({
      telemetry: {
        onLagDetected: () => setStatus('error', 'Refresh loop lag detected'),
        onTick: () => livePreviewTickRef.current(),
      },
    });
  }

  useEffect(() => {
    const scheduler = refreshSchedulerRef.current;
    scheduler?.start();
    return () => scheduler?.stop();
  }, []);

  useEffect(() => {
    cacheSyncWorker.start();
    return () => cacheSyncWorker.stop();
  }, []);

  useEffect(() => {
    hasManualEntryRef.current = hasManualEntry;
  }, [hasManualEntry]);

  const handleSnapshot = useCallback(
    (incoming: MarketSnapshot) => {
      latestPriceRef.current = incoming.lastPrice;
      if (!hasManualEntryRef.current && !isEntryFocusedRef.current) {
        setInput({ entryPrice: incoming.lastPrice });
      }
      refreshSchedulerRef.current?.recordHeartbeat();
    },
    [setInput],
  );

  const marketStream = useMarketStream({
    symbols: [input.symbol],
    staleThresholdMs: freshnessThreshold,
    onSnapshot: handleSnapshot,
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
      if (requestSourceRef.current === 'manual') {
        setStatus('loading');
      }
    },
    onSuccess: (data) => {
      setOutput(data.output, data.marketSnapshot, data.warnings, new Date().toISOString());
      setStatus('success');
      livePreviewActiveRef.current = true;
    },
    onError: (error: Error) => {
      setStatus('error', error.message);
    },
  });

  const requestPreview = useCallback(
    (source: 'manual' | 'live') => {
      if (source === 'live' && (!livePreviewActiveRef.current || previewMutation.isPending)) {
        return;
      }

      if (previewMutation.isPending && source === 'manual') {
        return;
      }

      const normalize = (value: string | null | undefined) => {
        if (value == null) {
          return null;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const normalizedStop = normalize(input.stopPrice);
      const normalizedEntry = normalize(input.entryPrice);

      if (!input.useVolatilityStop && normalizedStop == null) {
        if (source === 'live') {
          livePreviewActiveRef.current = false;
        }
        setStatus('error', 'Stop price is required when volatility stop is disabled');
        return;
      }

      requestSourceRef.current = source;

      previewMutation.mutate({
        ...input,
        entryPrice: normalizedEntry,
        stopPrice: normalizedStop,
        riskPercent: settingsRiskPercent,
        atrMultiplier: settingsAtrMultiplier,
      });
    },
    [input, previewMutation, settingsAtrMultiplier, settingsRiskPercent, setStatus],
  );

  useEffect(() => {
    livePreviewTickRef.current = () => {
      requestPreview('live');
    };
  }, [requestPreview]);

  const handleCalculate = () => {
    requestPreview('manual');
  };

  const isLoading = status === 'loading';

  const formatPriceValue = useCallback((value: string | null | undefined) => {
    if (value == null) {
      return '—';
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return value;
    }
    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const riskRewardStyle = useMemo(() => {
    if (!output) {
      return styles.metricNeutral;
    }
    if (output.riskToReward > 1.5) {
      return styles.metricPositive;
    }
    if (output.riskToReward < 1.2) {
      return styles.metricNegative;
    }
    return styles.metricNeutral;
  }, [output]);

  const riskRewardDisplay = output ? formatPercent(output.riskToReward) : '—';
  const effectiveStop = input.useVolatilityStop ? output?.suggestedStop ?? null : input.stopPrice;
  const atrDisplay = snapshot ? formatPriceValue(snapshot.atr13) : '—';
  const visualizationStop = input.useVolatilityStop
    ? output?.suggestedStop ?? ''
    : input.stopPrice ?? '';

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

      <StaleBanner
        status={marketStream.status}
        reconnectAttempts={marketStream.reconnectAttempts}
        lastUpdatedAt={marketStream.lastUpdatedAt}
        onReconnect={marketStream.reconnect}
      />

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
            onFocus={() => {
              isEntryFocusedRef.current = true;
            }}
            onBlur={() => {
              isEntryFocusedRef.current = false;
              if (!useTradeCalculatorStore.getState().hasManualEntry) {
                setInput({ entryPrice: latestPriceRef.current });
              }
            }}
            onChangeText={(value) => {
              if (value.trim().length === 0) {
                hasManualEntryRef.current = false;
                setHasManualEntry(false);
                setInput({ entryPrice: null });
              } else {
                hasManualEntryRef.current = true;
                setHasManualEntry(true);
                setInput({ entryPrice: value });
              }
            }}
            style={styles.input}
          />
        </View>
        <View style={styles.fieldRow}>
          <Text style={styles.label}>Stop Price</Text>
          <TextInput
            value={input.stopPrice ?? ''}
            keyboardType="decimal-pad"
            editable={!input.useVolatilityStop}
            placeholder={input.useVolatilityStop ? 'ATR auto-stop' : undefined}
            onChangeText={(value) => {
              if (value.trim().length === 0) {
                setInput({ stopPrice: null });
              } else {
                setInput({ stopPrice: value });
              }
            }}
            style={[styles.input, input.useVolatilityStop && styles.inputDisabled]}
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
            onValueChange={(value) => {
              if (value) {
                setInput({ useVolatilityStop: true, stopPrice: null });
              } else {
                const fallbackStop =
                  output?.suggestedStop ??
                  input.stopPrice ??
                  latestPriceRef.current ??
                  '0.00';
                setInput({ useVolatilityStop: false, stopPrice: fallbackStop });
              }
            }}
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
          <View style={styles.tradeBillHeader}>
            <Text style={styles.sectionTitle}>Trade Bill</Text>
            <Text style={styles.timestampLabel}>Updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '—'}</Text>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Risk / Reward</Text>
              <Text style={[styles.metricValue, riskRewardStyle]}>{riskRewardDisplay}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Position Cost</Text>
              <Text style={[styles.metricValue, styles.metricAccent]}>{formatCurrency(output.positionCost)}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Position Size</Text>
            <Text style={styles.detailValue}>{Number(output.positionSize).toFixed(4)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Risk Amount</Text>
            <Text style={styles.detailValue}>{formatCurrency(output.riskAmount)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Risk Percent</Text>
            <Text style={styles.detailValue}>{formatPercent(Number(settingsRiskPercent))}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stop Price</Text>
            <Text style={styles.detailValue}>{formatPriceValue(effectiveStop)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Target Price</Text>
            <Text style={styles.detailValue}>{formatPriceValue(input.targetPrice)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ATR (13)</Text>
            <Text style={styles.detailValue}>{atrDisplay}</Text>
          </View>
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
            stopPrice={visualizationStop}
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
  tradeBillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricAccent: {
    color: '#0284C7',
  },
  metricPositive: {
    color: '#16A34A',
  },
  metricNeutral: {
    color: '#F97316',
  },
  metricNegative: {
    color: '#DC2626',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#475569',
    fontSize: 14,
  },
  detailValue: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 14,
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
  inputDisabled: {
    backgroundColor: '#E2E8F0',
    color: '#94A3B8',
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
