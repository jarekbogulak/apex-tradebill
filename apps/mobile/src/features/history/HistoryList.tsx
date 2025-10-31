import type { TradeCalculation } from '@apex-tradebill/types';
import { formatCurrency } from '@apex-tradebill/utils';
import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { palette, radii, spacing } from '../trade-calculator/styles/tokens';

export interface HistoryListProps {
  items: TradeCalculation[];
  loading?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
}

const keyExtractor = (item: TradeCalculation) => item.id;

export const HistoryList = ({ items, loading = false, onRefresh, onLoadMore }: HistoryListProps) => {
  const data = useMemo(
    () =>
      items.filter((item) => {
        return Boolean(item && item.input && item.output);
      }),
    [items],
  );

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh ?? (() => undefined)} />}
      onEndReachedThreshold={0.75}
      onEndReached={() => onLoadMore?.()}
      scrollEnabled={false}
      renderItem={({ item }) => {
        const ratio = Number(item.output.riskToReward);
        const riskRewardValue = Number.isFinite(ratio) ? ratio.toFixed(2) : '—';

        return (
          <View style={styles.item}>
            <View style={styles.headerRow}>
              <Text style={styles.symbol}>{item.input.symbol}</Text>
              <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Position</Text>
              <Text style={styles.value}>{Number(item.output.positionSize).toFixed(4)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Risk</Text>
              <Text style={styles.value}>{formatCurrency(item.output.riskAmount)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Risk/Reward</Text>
              <Text style={styles.value}>{riskRewardValue}</Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyPlaceholder}>
            <Text style={styles.emptyTitle}>No recent calculations yet</Text>
            <Text style={styles.emptyCopy}>Run a calculation and it will appear here.</Text>
          </View>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  item: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.surfaceMuted,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  symbol: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    color: palette.textMuted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: palette.textMuted,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlaceholder: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.surfaceMuted,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surfaceAlt,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  emptyCopy: {
    fontSize: 13,
    color: palette.textMuted,
    textAlign: 'center',
  },
});
