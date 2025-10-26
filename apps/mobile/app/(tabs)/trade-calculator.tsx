import type { MarketSnapshot, TradeInput } from '@apex-tradebill/types';
import { formatCurrency, formatPercent } from '@apex-tradebill/utils';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
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
import {
  selectCalculatorInput,
  selectCalculatorStatus,
  type TradeCalculatorInputState,
  type TradeCalculatorStatus,
  useTradeCalculatorStore,
} from '@/src/state/tradeCalculatorStore';
import { selectFreshnessThreshold, selectRiskConfig, useSettingsStore } from '@/src/state/settingsStore';
import { createApiClient } from '@/src/services/apiClient';
import { createCacheSyncWorker } from '@/src/sync/cacheSync';

const apiClient = createApiClient();
const cacheSyncWorker = createCacheSyncWorker();

export default function TradeCalculatorScreen() {
  const input = useTradeCalculatorStore(selectCalculatorInput);
  const status = useTradeCalculatorStore(selectCalculatorStatus);
  const output = useTradeCalculatorStore((state) => state.output);
  const warnings = useTradeCalculatorStore((state) => state.warnings);
  const lastUpdatedAt = useTradeCalculatorStore((state) => state.lastUpdatedAt);
  const snapshot = useTradeCalculatorStore((state) => state.snapshot);
  const errorMessage = useTradeCalculatorStore((state) => state.error);
  const setInput = useTradeCalculatorStore((state) => state.setInput);
  const setOutput = useTradeCalculatorStore((state) => state.setOutput);
  const setStatus = useTradeCalculatorStore((state) => state.setStatus);
  const hasManualEntry = useTradeCalculatorStore((state) => state.hasManualEntry);
  const setHasManualEntry = useTradeCalculatorStore((state) => state.setHasManualEntry);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>(output ? 'edit' : 'create');
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
      queryFn: ({ pageParam }) =>
          apiClient.getTradeHistory({
              cursor: typeof pageParam === 'string' ? pageParam : undefined,
          }),
      getNextPageParam: (lastPage: any) => lastPage?.nextCursor ?? undefined,
      initialPageParam: undefined,
  });

    const historyItems =
        historyQuery.data?.pages.flatMap((page: any) => page?.items ?? []) ?? [];

    useEffect(() => {
        if (!output) {
            setFormMode('create');
        }
    }, [output]);

    const handleOpenCreate = useCallback(() => {
        setFormMode('create');
        setIsFormOpen(true);
    }, []);

    const handleOpenEdit = useCallback(() => {
        setFormMode('edit');
        setIsFormOpen(true);
    }, []);

    const handleCloseForm = useCallback(() => {
        setIsFormOpen(false);
    }, []);

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
      if (requestSourceRef.current === 'manual') {
        setIsFormOpen(false);
        setFormMode('edit');
      }
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

    const handleAccountSizeChange = useCallback(
        (value: string) => {
            setInput({ accountSize: value });
        },
        [setInput],
    );

    const handleEntryFocus = useCallback(() => {
        isEntryFocusedRef.current = true;
    }, []);

    const handleEntryBlur = useCallback(() => {
        isEntryFocusedRef.current = false;
        if (!useTradeCalculatorStore.getState().hasManualEntry) {
            setInput({ entryPrice: latestPriceRef.current });
        }
    }, [setInput]);

    const handleEntryPriceChange = useCallback(
        (value: string) => {
            if (value.trim().length === 0) {
                hasManualEntryRef.current = false;
                setHasManualEntry(false);
                setInput({ entryPrice: null });
            } else {
                hasManualEntryRef.current = true;
                setHasManualEntry(true);
                setInput({ entryPrice: value });
            }
        },
        [setHasManualEntry, setInput],
    );

    const handleTargetPriceChange = useCallback(
        (value: string) => {
            setInput({ targetPrice: value });
        },
        [setInput],
    );

    const handleStopPriceChange = useCallback(
        (value: string) => {
            if (value.trim().length === 0) {
                setInput({ stopPrice: null });
            } else {
                setInput({ stopPrice: value });
            }
        },
        [setInput],
    );

    const handleVolatilityToggle = useCallback(
        (value: boolean) => {
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
        },
        [input.stopPrice, output, setInput],
    );

    const handleDirectionChange = useCallback(
        (direction: 'long' | 'short') => {
            setInput({ direction });
        },
        [setInput],
    );

    const handleSubmitForm = useCallback(() => {
    requestPreview('manual');
  }, [requestPreview]);

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
    const hasOutput = Boolean(output);
    const marketPlaceholder = marketStream.snapshot?.lastPrice ?? 'Market';

  return (
      <>
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

              {hasOutput ? (
                  <View style={styles.card}>
                      <View style={styles.tradeBillHeader}>
                          <View>
                              <Text style={styles.sectionTitle}>Trade Bill</Text>
                              <Text style={styles.timestampLabel}>
                                  Updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '—'}
                              </Text>
                          </View>
                          <Pressable style={styles.secondaryButton} onPress={handleOpenEdit}>
                              <Text style={styles.secondaryButtonLabel}>Edit</Text>
                          </Pressable>
                      </View>
                      <View style={styles.metricRow}>
                          <View style={styles.metricCard}>
                              <Text style={styles.metricLabel}>Risk / Reward</Text>
                              <Text style={[styles.metricValue, riskRewardStyle]}>{riskRewardDisplay}</Text>
                          </View>
                          <View style={styles.metricCard}>
                              <Text style={styles.metricLabel}>Position Cost</Text>
                              <Text style={[styles.metricValue, styles.metricAccent]}>
                                  {output ? formatCurrency(output.positionCost) : '—'}
                              </Text>
                          </View>
                      </View>
                      <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Position Size</Text>
                          <Text style={styles.detailValue}>
                              {output ? Number(output.positionSize).toFixed(4) : '—'}
                          </Text>
                      </View>
                      <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Risk Amount</Text>
                          <Text style={styles.detailValue}>
                              {output ? formatCurrency(output.riskAmount) : '—'}
                          </Text>
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
              ) : (
                  <View style={styles.card}>
                      <Text style={styles.sectionTitle}>Trade Bill</Text>
                      <Text style={styles.emptyStateText}>Create a trade to see position sizing details.</Text>
                      {status === 'error' && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                      <Pressable style={styles.primaryButton} onPress={handleOpenCreate}>
                          <Text style={styles.primaryButtonLabel}>Create Trade</Text>
                      </Pressable>
                  </View>
              )}

              {hasOutput && status === 'error' && errorMessage ? (
                  <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>{errorMessage}</Text>
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

            <TradeInputSheet
                visible={isFormOpen}
                mode={formMode}
                input={input}
                marketPlaceholder={marketPlaceholder}
                onClose={handleCloseForm}
                onSubmit={handleSubmitForm}
                onAccountSizeChange={handleAccountSizeChange}
                onEntryFocus={handleEntryFocus}
                onEntryBlur={handleEntryBlur}
                onEntryPriceChange={handleEntryPriceChange}
                onTargetPriceChange={handleTargetPriceChange}
                onStopPriceChange={handleStopPriceChange}
                onVolatilityToggle={handleVolatilityToggle}
                onDirectionChange={handleDirectionChange}
                isSubmitting={isLoading}
                status={status}
                errorMessage={errorMessage}
            />
        </>
    );
}

interface TradeInputSheetProps {
    visible: boolean;
    mode: 'create' | 'edit';
    input: TradeCalculatorInputState;
    marketPlaceholder: string;
    onClose: () => void;
    onSubmit: () => void;
    onAccountSizeChange: (value: string) => void;
    onEntryFocus: () => void;
    onEntryBlur: () => void;
    onEntryPriceChange: (value: string) => void;
    onTargetPriceChange: (value: string) => void;
    onStopPriceChange: (value: string) => void;
    onVolatilityToggle: (value: boolean) => void;
    onDirectionChange: (direction: 'long' | 'short') => void;
    isSubmitting: boolean;
    status: TradeCalculatorStatus;
    errorMessage: string | null;
}

function TradeInputSheet({
    visible,
    mode,
    input,
    marketPlaceholder,
    onClose,
    onSubmit,
    onAccountSizeChange,
    onEntryFocus,
    onEntryBlur,
    onEntryPriceChange,
    onTargetPriceChange,
    onStopPriceChange,
    onVolatilityToggle,
    onDirectionChange,
    isSubmitting,
    status,
    errorMessage,
}: TradeInputSheetProps) {
    const title = mode === 'edit' ? 'Edit Trade' : 'New Trade';
    const actionLabel = isSubmitting ? 'Working…' : 'Done';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
            presentationStyle="overFullScreen"
        >
            <View style={styles.sheetOverlay}>
                <Pressable
                    style={styles.sheetBackdrop}
                    onPress={() => {
                        if (!isSubmitting) {
                            onClose();
                        }
                    }}
        />
              <KeyboardAvoidingView
                  behavior={Platform.select({ ios: 'padding', android: 'height' })}
                  style={styles.sheetKeyboard}
              >
                  <View style={styles.sheetContainer}>
                      <View style={styles.sheetHandle} />
                      <ScrollView
                          contentContainerStyle={styles.sheetContent}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                      >
                          <View style={styles.sheetHeaderRow}>
                              <Text style={styles.sheetTitle}>{title}</Text>
                              <Pressable style={styles.sheetCancelLink} onPress={onClose} disabled={isSubmitting}>
                                  <Text style={styles.sheetCancelLabel}>Cancel</Text>
                              </Pressable>
                          </View>

                          <Text style={styles.label}>Direction</Text>
                          <View style={styles.segmentGroup}>
                              <Pressable
                                  style={[styles.segment, input.direction === 'long' && styles.segmentActive]}
                                  onPress={() => onDirectionChange('long')}
                              >
                                  <Text style={[styles.segmentLabel, input.direction === 'long' && styles.segmentLabelActive]}>
                                      Long
                                  </Text>
                              </Pressable>
                              <Pressable
                                  style={[styles.segment, input.direction === 'short' && styles.segmentActive]}
                                  onPress={() => onDirectionChange('short')}
                              >
                                  <Text style={[styles.segmentLabel, input.direction === 'short' && styles.segmentLabelActive]}>
                                      Short
                                  </Text>
                              </Pressable>
                          </View>

                          <View style={styles.fieldRow}>
                              <Text style={styles.label}>Account Size</Text>
                              <TextInput
                                  value={input.accountSize}
                                  keyboardType="decimal-pad"
                                  onChangeText={onAccountSizeChange}
                                  style={styles.input}
                              />
                          </View>

                          <View style={styles.fieldRow}>
                              <Text style={styles.label}>Entry Price</Text>
                              <TextInput
                                  value={input.entryPrice ?? ''}
                                  keyboardType="decimal-pad"
                                  placeholder={marketPlaceholder}
                                  onFocus={onEntryFocus}
                                  onBlur={onEntryBlur}
                                  onChangeText={onEntryPriceChange}
                                  style={styles.input}
                              />
                          </View>

                          <View style={styles.fieldRow}>
                              <Text style={styles.label}>Target Price</Text>
                              <TextInput
                                  value={input.targetPrice}
                                  keyboardType="decimal-pad"
                                  onChangeText={onTargetPriceChange}
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
                                  onChangeText={onStopPriceChange}
                                  style={[styles.input, input.useVolatilityStop && styles.inputDisabled]}
                              />
                          </View>

                          <View style={styles.switchRow}>
                              <Text style={styles.label}>Use Volatility Stop</Text>
                              <Switch value={input.useVolatilityStop} onValueChange={onVolatilityToggle} />
                          </View>

                          {status === 'error' && errorMessage ? (
                              <Text style={styles.sheetErrorText}>{errorMessage}</Text>
                          ) : null}

                          <Pressable
                              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
                              onPress={onSubmit}
                              disabled={isSubmitting}
                          >
                              <Text style={styles.primaryButtonLabel}>{actionLabel}</Text>
                          </Pressable>
                      </ScrollView>
                  </View>
              </KeyboardAvoidingView>
          </View>
      </Modal>
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
      alignItems: 'center',
      gap: 16,
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
    primaryButton: {
        backgroundColor: '#0284C7',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
  },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
      borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
    secondaryButtonLabel: {
        color: '#0284C7',
    fontWeight: '600',
  },
    emptyStateText: {
        color: '#64748B',
        marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
  },
    errorBanner: {
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        padding: 12,
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
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end',
    },
    sheetBackdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    sheetKeyboard: {
        width: '100%',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingBottom: 24,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 48,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5F5',
        marginBottom: 12,
    },
    sheetContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 16,
    },
    sheetHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sheetTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0F172A',
    },
    sheetCancelLink: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    sheetCancelLabel: {
        color: '#64748B',
        fontWeight: '600',
    },
    segmentGroup: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    segment: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    segmentActive: {
        backgroundColor: '#0284C7',
    },
    segmentLabel: {
        fontWeight: '600',
        color: '#475569',
    },
    segmentLabelActive: {
        color: '#FFFFFF',
    },
    sheetErrorText: {
        color: '#DC2626',
    },
});
