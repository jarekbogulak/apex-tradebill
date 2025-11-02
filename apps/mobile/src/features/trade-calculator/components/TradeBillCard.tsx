import { useMemo } from 'react';
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@apex-tradebill/utils';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TradeWarningCode } from '@apex-tradebill/types';
import { useTheme, type Theme } from '@apex-tradebill/ui';

import { RiskVisualization } from '@/src/features/visualization/RiskVisualization';
import type { TradeCalculatorInputState, TradeCalculatorState } from '@/src/state/tradeCalculatorStore';

import type { RiskTone } from '../hooks/useTradeCalculatorController';
import { formatPriceValue } from '../utils/formatters';

interface TradeBillCardProps {
  input: TradeCalculatorInputState;
  output: NonNullable<TradeCalculatorState['output']>;
  lastUpdatedAt: string | null;
  warnings: TradeWarningCode[];
  riskSummary: {
    tone: RiskTone;
    riskToReward: number | null;
    riskPercent: string;
  };
  derivedValues: {
    effectiveStop: string | null;
    atrValue: string | null;
    visualizationStop: string;
  };
  onEditPress: () => void;
  onExecutePress: () => void;
  canExecute: boolean;
  isExecuting: boolean;
}

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const formatRiskReward = (ratio: number | null) => {
  if (ratio == null || Number.isNaN(ratio)) {
    return '—';
  }

  return ratio.toFixed(2);
};

export const TradeBillCard = ({
  input,
  output,
  lastUpdatedAt,
  warnings,
  riskSummary,
  derivedValues,
  onEditPress,
  onExecutePress,
  canExecute,
  isExecuting,
}: TradeBillCardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const riskToneColors = useMemo(() => createRiskToneColors(theme), [theme]);
  const baseAsset = input.symbol.split('-')[0] ?? input.symbol;
  const tradeDetails = [
    { label: 'Position Size', value: `${Number(output.positionSize).toFixed(4)} ${baseAsset}` },
    { label: 'Stop Price', value: formatPriceValue(derivedValues.effectiveStop) },
    { label: 'Target Price', value: formatPriceValue(input.targetPrice) },
  ];
  const riskDetails = [
    { label: 'Risk Amount', value: formatCurrency(output.riskAmount) },
    { label: 'Risk Percent', value: formatPercent(Number(riskSummary.riskPercent)) },
    { label: 'ATR (13)', value: formatPriceValue(derivedValues.atrValue) },
  ];
  const detailGroups = [
    { title: 'Trade', items: tradeDetails },
    { title: 'Risk', items: riskDetails },
  ];
  const executeDisabled = !canExecute || isExecuting;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.sectionTitle}>Trade Bill</Text>
          <Text style={styles.timestamp}>Last calc: {formatTimestamp(lastUpdatedAt)}</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={onEditPress} accessibilityRole="button">
          <Text style={styles.primaryButtonLabel}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Risk / Reward</Text>
          <Text
            style={[
              styles.metricValue,
              { color: riskToneColors[riskSummary.tone] ?? riskToneColors.neutral },
            ]}
            numberOfLines={1}
          >
            {formatRiskReward(riskSummary.riskToReward)}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Position Cost</Text>
          <Text style={[styles.metricValue, styles.metricAccent]} numberOfLines={1}>
            {formatCurrencyCompact(output.positionCost)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailGroups}>
        {detailGroups.map((group) => (
          <View key={group.title} style={styles.detailGroup}>
            <Text style={styles.detailGroupLabel}>{group.title}</Text>
            <View style={styles.detailTable}>
              {group.items.map((item, index) => (
                <DetailRow
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  isLast={index === group.items.length - 1}
                  styles={styles}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      {warnings.length > 0 ? (
        <View style={styles.warningContainer}>
          {warnings.map((warning) => (
            <Text key={warning} style={styles.warningText}>
              • {warning.replace(/_/g, ' ')}
            </Text>
          ))}
        </View>
      ) : null}

      <RiskVisualization
        direction={input.direction}
        entryPrice={input.entryPrice}
        stopPrice={derivedValues.visualizationStop}
        targetPrice={input.targetPrice}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.executeButton, executeDisabled && styles.executeButtonDisabled]}
          onPress={onExecutePress}
          disabled={executeDisabled}
          accessibilityRole="button"
          accessibilityLabel="Execute trade bill"
        >
          {isExecuting ? (
            <ActivityIndicator size="small" color={theme.colors.textInverted} />
          ) : (
            <Text style={styles.executeButtonLabel}>Execute</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const DetailRow = ({
  label,
  value,
  isLast,
  styles,
}: {
  label: string;
  value: string;
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={[styles.detailRow, !isLast && styles.detailRowDivider]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const createRiskToneColors = (theme: Theme): Record<RiskTone, string> => ({
  positive: theme.colors.success,
  neutral: theme.colors.neutral,
  negative: theme.colors.error,
});

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
      gap: theme.spacing.lg,
    },
    headerCopy: {
      gap: theme.spacing.xs,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    timestamp: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    metricRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    metricCard: {
      flex: 1,
      borderRadius: theme.radii.md,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceMuted,
    },
    metricLabel: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    metricValue: {
      marginTop: theme.spacing.xs,
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    metricAccent: {
      color: theme.colors.accent,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    detailGroups: {
      gap: theme.spacing.lg,
    },
    detailGroup: {
      gap: theme.spacing.sm,
    },
    detailGroupLabel: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: theme.colors.textMuted,
    },
    detailTable: {
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.surfaceMuted,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
    },
    detailRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.surfaceMuted,
    },
    detailLabel: {
      color: theme.colors.textMuted,
      fontSize: 13,
    },
    detailValue: {
      color: theme.colors.textPrimary,
      fontSize: 14,
    },
    warningContainer: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.warningSurface,
      borderRadius: theme.radii.md,
    },
    warningText: {
      color: theme.colors.warning,
      fontSize: 12,
    },
    primaryButton: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.sm + 2,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.accent,
    },
    primaryButtonLabel: {
      color: theme.colors.textInverted,
      fontWeight: '600',
      fontSize: 15,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.divider,
    },
    footer: {
      marginTop: theme.spacing.md,
    },
    executeButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    executeButtonDisabled: {
      opacity: 0.5,
    },
    executeButtonLabel: {
      color: theme.colors.textInverted,
      fontWeight: '700',
      fontSize: 16,
    },
  } as const;
};
