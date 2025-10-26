import type { TradeCalculation } from '@apex-tradebill/types';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HistoryList } from '@/src/features/history/HistoryList';

import { palette, radii, spacing } from '../styles/tokens';

interface TradeHistoryCardProps {
  items: TradeCalculation[];
  isFetching: boolean;
  isFetchingNextPage: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
}

export const TradeHistoryCard = ({
  items,
  isFetching,
  isFetchingNextPage,
  onRefresh,
  onLoadMore,
}: TradeHistoryCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent History</Text>
        {isFetching ? <ActivityIndicator size="small" /> : null}
      </View>
      <HistoryList
        items={items}
        loading={isFetching && !isFetchingNextPage}
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
  },
});
