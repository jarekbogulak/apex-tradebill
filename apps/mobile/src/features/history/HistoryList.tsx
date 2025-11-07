import { useMemo } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { formatCurrency } from '@apex-tradebill/utils';
import type { TradeCalculation } from '@apex-tradebill/types';
import { useTheme, type Theme } from '@apex-tradebill/ui';

import { ErrorMessageBlock } from '@/components/ui/ErrorMessageBlock';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatFriendlyError } from '@/src/utils/api-error';

export interface HistoryListProps {
  items: TradeCalculation[];
  loading?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  error?: Error | null;
}

const keyExtractor = (item: TradeCalculation) => item.id;

export const HistoryList = ({
  items,
  loading = false,
  onRefresh,
  onLoadMore,
  error = null,
}: HistoryListProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const data = useMemo(
    () =>
      items.filter((item) => {
        return Boolean(item && item.input && item.output);
      }),
    [items],
  );
  const errorMessage = formatFriendlyError(error ?? null, 'Failed to load trade history.');
  const renderErrorCard = () => (
    <ErrorMessageBlock
      title="Unable to load history"
      message={errorMessage}
      hint="Use the refresh button above to try again."
    />
  );

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh ?? (() => undefined)}
          tintColor={theme.colors.accent}
        />
      }
      onEndReachedThreshold={0.75}
      onEndReached={() => onLoadMore?.()}
      scrollEnabled={false}
      ListHeaderComponent={
        error && data.length > 0 ? (
          <View style={styles.errorHeader}>{renderErrorCard()}</View>
        ) : null
      }
      renderItem={({ item }) => {
        const ratio = Number(item.output.riskToReward);
        const riskRewardValue = Number.isFinite(ratio) ? ratio.toFixed(2) : '—';

        return (
          <View style={styles.item}>
            <View style={styles.headerRow}>
              <Text style={styles.symbol}>{item.input.symbol}</Text>
              <Text style={styles.timestamp}>{new Date(item.executedAt).toLocaleString()}</Text>
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
          {error ? (
            <View style={styles.errorEmpty}>{renderErrorCard()}</View>
          ) : (
            <View style={styles.emptyPlaceholder}>
              <IconSymbol
                name="clock"
                size={36}
                weight="semibold"
                color={theme.colors.textMuted}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>No recent calculations yet</Text>
              <Text style={styles.emptyCopy}>Run a calculation and it will appear here.</Text>
            </View>
          )}
        </View>
      }
    />
  );
};

const createStyles = (theme: Theme) =>
  ({
    item: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radii.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceMuted,
      gap: theme.spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    symbol: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    value: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    empty: {
      paddingVertical: theme.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorHeader: {
      marginBottom: theme.spacing.md,
    },
    errorEmpty: {
      width: '100%',
    },
    emptyPlaceholder: {
      width: '100%',
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.surfaceMuted,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    emptyIcon: {
      marginBottom: theme.spacing.xs,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    emptyCopy: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
  }) as const;
