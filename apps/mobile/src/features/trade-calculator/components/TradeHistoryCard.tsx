import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { TradeCalculation } from '@apex-tradebill/types';
import { useTheme, type Theme } from '@apex-tradebill/ui';

import { HistoryList } from '@/src/features/history/HistoryList';
import { ErrorMessageBlock } from '@/components/ui/ErrorMessageBlock';

interface TradeHistoryCardProps {
  items: TradeCalculation[];
  isFetching: boolean;
  onRefresh: () => void;
  error?: Error | null;
  historyUnavailable?: boolean;
  lastCheckedAt?: number | null;
}

export const TradeHistoryCard = ({
  items,
  isFetching,
  onRefresh,
  error = null,
  historyUnavailable = false,
  lastCheckedAt = null,
}: TradeHistoryCardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const shouldShowLoadingState = isFetching && !error && items.length === 0;
  const refreshDisabled = isFetching;
  const lastCheckedText = formatLastChecked(lastCheckedAt);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent History</Text>
        <Pressable
          disabled={refreshDisabled}
          onPress={onRefresh}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && !refreshDisabled ? styles.refreshButtonPressed : null,
            refreshDisabled ? styles.refreshButtonDisabled : null,
          ]}
        >
          <Text style={styles.refreshLabel}>{isFetching ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      </View>
      {historyUnavailable ? (
        <View style={styles.unavailableBlock}>
          <ErrorMessageBlock
            title="Trade history offline"
            message="The server is running without its database, so your past calculations are momentarily hidden."
            hint="Tap refresh to check again or wait for automatic retries."
            testID="trade-history-unavailable"
          />
          <Text style={[styles.metaText, styles.unavailableMetaText]}>
            Last checked: {lastCheckedText}
          </Text>
        </View>
      ) : shouldShowLoadingState ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Text style={styles.loadingCopy}>Loading history…</Text>
        </View>
      ) : (
        <>
          <HistoryList items={items} loading={isFetching} onRefresh={onRefresh} error={error} />
          <Text style={styles.metaText}>Last updated: {lastCheckedText}</Text>
        </>
      )}
    </View>
  );
};

const formatLastChecked = (timestamp: number | null) => {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
      gap: theme.spacing.md,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    refreshButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    refreshButtonPressed: {
      opacity: 0.6,
    },
    refreshButtonDisabled: {
      opacity: 0.5,
    },
    refreshLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    unavailableBlock: {
      width: '100%',
      gap: theme.spacing.md,
    },
    loadingState: {
      minHeight: 160,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    loadingCopy: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    metaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    unavailableMetaText: {
      marginTop: theme.spacing.xs,
    },
  } as const;
};
