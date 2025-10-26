import { ScrollView, StyleSheet } from 'react-native';

import StaleBanner from '@/src/features/stream/StaleBanner';

import { MarketStatusCard } from '@/src/features/trade-calculator/components/MarketStatusCard';
import { TradeBillCard } from '@/src/features/trade-calculator/components/TradeBillCard';
import { TradeBillEmptyCard } from '@/src/features/trade-calculator/components/TradeBillEmptyCard';
import { TradeErrorBanner } from '@/src/features/trade-calculator/components/TradeErrorBanner';
import { TradeHistoryCard } from '@/src/features/trade-calculator/components/TradeHistoryCard';
import { TradeInputSheet } from '@/src/features/trade-calculator/components/TradeInputSheet';
import { useTradeCalculatorController } from '@/src/features/trade-calculator/hooks/useTradeCalculatorController';
import { palette, spacing } from '@/src/features/trade-calculator/styles/tokens';

export default function TradeCalculatorScreen() {
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
    marketStream,
    historyItems,
    historyQuery,
    riskSummary,
    derivedValues,
    shouldShowErrorBanner,
    actions,
    fieldHandlers,
  } = useTradeCalculatorController();

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <MarketStatusCard
          symbol={input.symbol}
          streamStatus={marketStream.status}
          lastPrice={marketStream.snapshot?.lastPrice}
        />

        <StaleBanner
          status={marketStream.status}
          reconnectAttempts={marketStream.reconnectAttempts}
          lastUpdatedAt={marketStream.lastUpdatedAt}
          onReconnect={marketStream.reconnect}
        />

        {hasOutput && output ? (
          <TradeBillCard
            input={input}
            output={output}
            lastUpdatedAt={lastUpdatedAt}
            warnings={warnings}
            riskSummary={riskSummary}
            derivedValues={derivedValues}
            onEditPress={actions.openEdit}
          />
        ) : (
          <TradeBillEmptyCard status={status} errorMessage={errorMessage} onCreatePress={actions.openCreate} />
        )}

        {shouldShowErrorBanner && errorMessage ? <TradeErrorBanner message={errorMessage} /> : null}

        <TradeHistoryCard
          items={historyItems}
          isFetching={historyQuery.isFetching}
          isFetchingNextPage={historyQuery.isFetchingNextPage}
          onRefresh={() => historyQuery.refetch()}
          onLoadMore={() => historyQuery.fetchNextPage()}
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

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: palette.surfaceAlt,
  },
});
