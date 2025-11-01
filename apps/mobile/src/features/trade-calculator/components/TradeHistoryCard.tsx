import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { TradeCalculation } from '@apex-tradebill/types';
import { useTheme, type Theme } from '@apex-tradebill/ui';

import { HistoryList } from '@/src/features/history/HistoryList';

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
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent History</Text>
        {isFetching ? <ActivityIndicator size="small" color={theme.colors.accent} /> : null}
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

const createStyles = (theme: Theme) => {
  const shadow = theme.shadows.level2;

  return {
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
      ...shadow,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
  } as const;
};
