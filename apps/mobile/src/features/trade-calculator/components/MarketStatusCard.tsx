import { StyleSheet, Text, View } from 'react-native';

import type { StreamStatus } from '@/src/features/stream/useMarketStream';

import { formatPriceValue } from '../utils/formatters';
import { palette, radii, spacing } from '../styles/tokens';

interface MarketStatusCardProps {
  symbol: string;
  streamStatus: StreamStatus;
  lastPrice?: string | null;
  lastUpdatedAt: number | null;
}

const statusCopyMap: Record<
  StreamStatus,
  {
    label: string;
    dotColor: string;
    textColor: string;
  }
> = {
  connected: {
    label: 'Connected',
    dotColor: palette.badgeSuccess,
    textColor: palette.textSecondary,
  },
  connecting: {
    label: 'Connecting',
    dotColor: palette.textAccent,
    textColor: palette.textAccent,
  },
  disconnected: {
    label: 'Disconnected',
    dotColor: palette.textMuted,
    textColor: palette.textError,
  },
  stale: {
    label: 'Stale',
    dotColor: palette.badgeWarning,
    textColor: palette.textWarning,
  },
};

const formatUpdatedTime = (timestamp: number | null) => {
  if (!timestamp) {
    return '—';
  }

  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

export const MarketStatusCard = ({
  symbol,
  streamStatus,
  lastPrice,
  lastUpdatedAt,
}: MarketStatusCardProps) => {
  const statusCopy = statusCopyMap[streamStatus] ?? statusCopyMap.connected;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.symbolGroup}>
          <Text style={styles.symbol}>{symbol}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusCopy.dotColor }]} />
            <Text style={[styles.statusText, { color: statusCopy.textColor }]}>
              {statusCopy.label}
            </Text>
            <Text style={styles.statusMeta}>Last updated: {formatUpdatedTime(lastUpdatedAt)}</Text>
          </View>
        </View>

        <Text style={styles.price}>{formatPriceValue(lastPrice)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolGroup: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  symbol: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusMeta: {
    fontSize: 13,
    color: palette.textMuted,
    marginLeft: spacing.sm,
  },
});
