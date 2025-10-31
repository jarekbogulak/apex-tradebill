import type { TradeWarningCode } from '@apex-tradebill/types';
import { formatCurrency, formatPercent } from '@apex-tradebill/utils';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RiskVisualization } from '@/src/features/visualization/RiskVisualization';
import type { TradeCalculatorInputState, TradeCalculatorState } from '@/src/state/tradeCalculatorStore';

import type { RiskTone } from '../hooks/useTradeCalculatorController';
import { formatPriceValue } from '../utils/formatters';
import { palette, radii, spacing } from '../styles/tokens';

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
}

const riskToneColorMap: Record<RiskTone, string> = {
  positive: palette.chipPositive,
  neutral: palette.chipNeutral,
  negative: palette.chipNegative,
};

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
}: TradeBillCardProps) => {
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
              { color: riskToneColorMap[riskSummary.tone] ?? palette.chipNeutral },
            ]}
          >
            {formatRiskReward(riskSummary.riskToReward)}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Position Cost</Text>
          <Text style={[styles.metricValue, styles.metricAccent]}>{formatCurrency(output.positionCost)}</Text>
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
    </View>
  );
};

const DetailRow = ({ label, value, isLast }: { label: string; value: string; isLast: boolean }) => (
  <View style={[styles.detailRow, !isLast && styles.detailRowDivider]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
    gap: spacing.lg,
  },
  headerCopy: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  timestamp: {
    color: palette.textSecondary,
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: palette.surfaceMuted,
  },
  metricLabel: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: '600',
  },
  metricValue: {
    marginTop: spacing.xs,
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  metricAccent: {
    color: palette.textAccent,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  detailGroups: {
    gap: spacing.lg,
  },
  detailGroup: {
    gap: spacing.sm,
  },
  detailGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: palette.textMuted,
  },
  detailTable: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.surfaceMuted,
    overflow: 'hidden',
    backgroundColor: palette.surface,
  },
  detailRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surfaceMuted,
  },
  detailLabel: {
    color: palette.textMuted,
    fontSize: 13,
  },
  detailValue: {
    color: palette.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  warningContainer: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: palette.warningBackground,
    borderRadius: radii.md,
  },
  warningText: {
    color: palette.textWarning,
    fontSize: 12,
  },
  primaryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.lg,
    backgroundColor: palette.textAccent,
  },
  primaryButtonLabel: {
    color: palette.surface,
    fontWeight: '600',
    fontSize: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.surfaceMuted,
  },
});
