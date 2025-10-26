import { StyleSheet, Text, View } from 'react-native';

import type { StreamStatus } from '@/src/features/stream/useMarketStream';

import { formatPriceValue } from '../utils/formatters';
import { palette, radii, spacing } from '../styles/tokens';

interface MarketStatusCardProps {
  symbol: string;
  streamStatus: StreamStatus;
  lastPrice?: string | null;
}

const statusStyleMap: Record<StreamStatus, string> = {
  connected: palette.badgeSuccess,
  connecting: palette.textAccent,
  disconnected: palette.textMuted,
  stale: palette.badgeWarning,
};

export const MarketStatusCard = ({ symbol, streamStatus, lastPrice }: MarketStatusCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={[styles.badge, { backgroundColor: statusStyleMap[streamStatus] ?? palette.textMuted }]}>
          {streamStatus.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.label}>Last Price</Text>
      <Text style={styles.value}>{formatPriceValue(lastPrice)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    fontSize: 12,
    fontWeight: '600',
    color: palette.surface,
  },
  label: {
    color: palette.textMuted,
    fontSize: 14,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
});
