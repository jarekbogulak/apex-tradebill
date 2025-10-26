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

export const TradeBillCard = ({
  input,
  output,
  lastUpdatedAt,
  warnings,
  riskSummary,
  derivedValues,
  onEditPress,
}: TradeBillCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionTitle}>Trade Bill</Text>
          <Text style={styles.timestamp}>
            Updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '—'}
          </Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={onEditPress}>
          <Text style={styles.secondaryButtonLabel}>Edit</Text>
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
            {riskSummary.riskToReward != null ? formatPercent(riskSummary.riskToReward) : '—'}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Position Cost</Text>
          <Text style={[styles.metricValue, styles.metricAccent]}>{formatCurrency(output.positionCost)}</Text>
        </View>
      </View>

      <DetailRow label="Position Size" value={Number(output.positionSize).toFixed(4)} />
      <DetailRow label="Risk Amount" value={formatCurrency(output.riskAmount)} />
      <DetailRow label="Risk Percent" value={formatPercent(Number(riskSummary.riskPercent))} />
      <DetailRow label="Stop Price" value={formatPriceValue(derivedValues.effectiveStop)} />
      <DetailRow label="Target Price" value={formatPriceValue(input.targetPrice)} />
      <DetailRow label="ATR (13)" value={formatPriceValue(derivedValues.atrValue)} />

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

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
    gap: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  timestamp: {
    color: palette.textMuted,
    fontSize: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: palette.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  metricLabel: {
    fontSize: 12,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  },
  detailLabel: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  detailValue: {
    color: palette.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  warningContainer: {
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: palette.warningBackground,
    borderRadius: radii.md,
  },
  warningText: {
    color: palette.textWarning,
    fontSize: 12,
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.divider,
  },
  secondaryButtonLabel: {
    color: palette.textAccent,
    fontWeight: '600',
  },
});
