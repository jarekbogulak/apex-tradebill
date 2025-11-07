import { useMemo } from 'react';
import { Text, View } from 'react-native';

import type { Symbol } from '@apex-tradebill/types';
import { useTheme, type Theme } from '@apex-tradebill/ui';

import type { StreamStatus } from '@/src/features/stream/useMarketStream';

import { formatPriceValue } from '../utils/formatters';
import { SymbolSelector } from './SymbolSelector';

interface MarketStatusCardProps {
  symbols: readonly Symbol[];
  selectedSymbol: Symbol;
  onSelect: (symbol: Symbol) => void;
  streamStatus: StreamStatus;
  lastPrice?: string | null;
  lastUpdatedAt: number | null;
}

const createStyles = (theme: Theme) => {
  const shadow = theme.shadows.level1;

  return {
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.md,
      ...shadow,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    price: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusText: {
      fontSize: 13,
      fontWeight: '500',
    },
    statusMeta: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
  } as const;
};

const getStatusCopy = (status: StreamStatus, theme: Theme) => {
  const statusMap: Record<
    StreamStatus,
    {
      label: string;
      dotColor: string;
      textColor: string;
    }
  > = {
    connected: {
      label: 'Connected',
      dotColor: theme.colors.success,
      textColor: theme.colors.textSecondary,
    },
    connecting: {
      label: 'Connecting',
      dotColor: theme.colors.accent,
      textColor: theme.colors.accent,
    },
    disconnected: {
      label: 'Disconnected',
      dotColor: theme.colors.textMuted,
      textColor: theme.colors.error,
    },
    stale: {
      label: 'Stale',
      dotColor: theme.colors.warning,
      textColor: theme.colors.warning,
    },
  };

  return statusMap[status] ?? statusMap.connected;
};

const formatUpdatedTime = (timestamp: number | null) => {
  if (!timestamp) {
    return '—';
  }

  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const MarketStatusCard = ({
  symbols,
  selectedSymbol,
  onSelect,
  streamStatus,
  lastPrice,
  lastUpdatedAt,
}: MarketStatusCardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const statusCopy = getStatusCopy(streamStatus, theme);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <SymbolSelector symbols={symbols} selectedSymbol={selectedSymbol} onSelect={onSelect} />
        <Text style={styles.price}>{formatPriceValue(lastPrice)}</Text>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusCopy.dotColor }]} />
        <Text style={[styles.statusText, { color: statusCopy.textColor }]}>
          {statusCopy.label}.
        </Text>
        <Text style={styles.statusMeta}>Last updated: {formatUpdatedTime(lastUpdatedAt)}</Text>
      </View>
    </View>
  );
};
