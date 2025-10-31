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
        {isFetching ? <ActivityIndicator size="small" color={palette.textAccent} /> : null}
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
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 4,
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
