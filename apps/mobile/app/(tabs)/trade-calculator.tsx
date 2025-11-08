import { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

import { MARKET_ALLOWLIST } from '@/src/config/marketAllowlist';
import StaleBanner from '@/src/features/stream/StaleBanner';
import { BackendStatusBanner } from '@/src/features/trade-calculator/components/BackendStatusBanner';
import { MarketStatusCard } from '@/src/features/trade-calculator/components/MarketStatusCard';
import { TradeBillCard } from '@/src/features/trade-calculator/components/TradeBillCard';
import { TradeBillEmptyCard } from '@/src/features/trade-calculator/components/TradeBillEmptyCard';
import { TradeErrorBanner } from '@/src/features/trade-calculator/components/TradeErrorBanner';
import { TradeHistoryCard } from '@/src/features/trade-calculator/components/TradeHistoryCard';
import { TradeInputSheet } from '@/src/features/trade-calculator/components/TradeInputSheet';
import { useTradeCalculatorController } from '@/src/features/trade-calculator/hooks/useTradeCalculatorController';

export default function TradeCalculatorScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    input,
    output,
    warnings,
    lastUpdatedAt,
    status,
    errorMessage,
    hasOutput,
    isFormOpen,
    formMode,
    isSubmitting,
    isExecuting,
    canExecute,
    marketStream,
    historyItems,
    historyQuery,
    historyError,
    historyUnavailable,
    historyLastCheckedAt,
    historyAutoRetryIntervalMs,
    riskSummary,
    derivedValues,
    shouldShowErrorBanner,
    actions,
    fieldHandlers,
  } = useTradeCalculatorController();

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        testID="trade-calculator-scroll"
      >
        <MarketStatusCard
          symbols={MARKET_ALLOWLIST}
          selectedSymbol={input.symbol}
          onSelect={actions.changeSymbol}
          streamStatus={marketStream.status}
          lastPrice={marketStream.snapshot?.lastPrice}
          lastUpdatedAt={marketStream.lastUpdatedAt}
        />

        {historyUnavailable ? (
          <BackendStatusBanner
            onRetry={() => historyQuery.refetch()}
            disabled={historyQuery.isFetching}
            autoRetryIntervalMs={historyAutoRetryIntervalMs ?? undefined}
          />
        ) : (
          <StaleBanner
            status={marketStream.status}
            reconnectAttempts={marketStream.reconnectAttempts}
            lastUpdatedAt={marketStream.lastUpdatedAt}
            onReconnect={marketStream.reconnect}
          />
        )}

        {hasOutput && output ? (
          <TradeBillCard
            input={input}
            output={output}
            lastUpdatedAt={lastUpdatedAt}
            warnings={warnings}
            riskSummary={riskSummary}
            derivedValues={derivedValues}
            onEditPress={actions.openEdit}
            onExecutePress={actions.execute}
            canExecute={canExecute}
            isExecuting={isExecuting}
          />
        ) : (
          <TradeBillEmptyCard
            status={status}
            errorMessage={errorMessage}
            onCreatePress={actions.openCreate}
          />
        )}

        {shouldShowErrorBanner && errorMessage ? <TradeErrorBanner message={errorMessage} /> : null}

        <TradeHistoryCard
          items={historyItems}
          isFetching={historyQuery.isFetching}
          error={historyError}
          historyUnavailable={historyUnavailable}
          lastCheckedAt={historyLastCheckedAt}
          autoRetryIntervalMs={historyAutoRetryIntervalMs ?? undefined}
          onRefresh={() => historyQuery.refetch()}
        />
      </ScrollView>

      <TradeInputSheet
        visible={isFormOpen}
        mode={formMode}
        input={input}
        marketPlaceholder={derivedValues.marketPlaceholder}
        onClose={actions.closeForm}
        onSubmit={actions.submitForm}
        onAccountSizeChange={fieldHandlers.onAccountSizeChange}
        onEntryFocus={fieldHandlers.onEntryFocus}
        onEntryBlur={fieldHandlers.onEntryBlur}
        onEntryPriceChange={fieldHandlers.onEntryPriceChange}
        onTargetPriceChange={fieldHandlers.onTargetPriceChange}
        onStopPriceChange={fieldHandlers.onStopPriceChange}
        onVolatilityToggle={fieldHandlers.onVolatilityToggle}
        onDirectionChange={fieldHandlers.onDirectionChange}
        isSubmitting={isSubmitting}
        status={status}
        errorMessage={errorMessage}
      />
    </>
  );
}

const createStyles = (theme: Theme) =>
  ({
    container: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceAlt,
    },
  }) as const;
