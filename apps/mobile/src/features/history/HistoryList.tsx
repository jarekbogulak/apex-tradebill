import type { TradeCalculation } from '@apex-tradebill/types';
import { formatCurrency, formatPercent } from '@apex-tradebill/utils';
import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

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
        return (
          <View style={styles.card}>
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
              <Text style={styles.value}>{formatPercent(item.output.riskToReward)}</Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No recent calculations yet.</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0F172A20',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748B',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: '#475569',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
  },
});
