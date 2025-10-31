import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Direction } from '@apex-tradebill/types';

export interface RiskVisualizationProps {
  direction: Direction;
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string;
}

const TRACK_MARGIN_PERCENT = 8;

const formatPrice = (value: number) => `$${value.toFixed(2)}`;
const formatSignedCurrency = (value: number) =>
  `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`;
const formatSignedPercent = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export const RiskVisualization = memo(
  ({ direction, entryPrice, stopPrice, targetPrice }: RiskVisualizationProps) => {
    const points = useMemo(() => {
      const toNumeric = (value: string | null | undefined) => {
        if (value == null || `${value}`.trim().length === 0) {
          return NaN;
        }
        return Number(value);
      };

      const entry = toNumeric(entryPrice);
      const stop = toNumeric(stopPrice);
      const target = toNumeric(targetPrice);

      if (![entry, stop, target].every((value) => Number.isFinite(value))) {
        return null;
      }

      const values = [entry, stop, target];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;

      const toPercent = (value: number) => ((value - min) / span) * 100;

      const applyTrackMargin = (percent: number) => {
        const clamped = Math.min(100, Math.max(0, percent));
        const available = 100 - TRACK_MARGIN_PERCENT * 2;
        return TRACK_MARGIN_PERCENT + (clamped / 100) * available;
      };

      const entryPercent = applyTrackMargin(toPercent(entry));
      const stopPercent = applyTrackMargin(toPercent(stop));
      const targetPercent = applyTrackMargin(toPercent(target));

      return {
        entry,
        stop,
        target,
        entryPercent,
        stopPercent,
        targetPercent,
        min,
        max,
      };
    }, [entryPrice, stopPrice, targetPrice]);

    if (!points) {
      return null;
    }

    const isLong = direction === 'long';
    const directionLabel = isLong ? 'LONG' : 'SHORT';

    const riskValue = isLong ? points.stop - points.entry : points.entry - points.stop;
    const rewardValue = isLong ? points.target - points.entry : points.entry - points.target;

    const entryBasis = points.entry === 0 ? 1 : Math.abs(points.entry);
    const riskPercent = (riskValue / entryBasis) * 100;
    const rewardPercent = (rewardValue / entryBasis) * 100;

    const rangeLabel = `${formatPrice(points.min)} - ${formatPrice(points.max)}`;

    const riskStart = Math.min(points.entryPercent, points.stopPercent);
    const riskWidth = Math.abs(points.entryPercent - points.stopPercent);
    const rewardStart = Math.min(points.entryPercent, points.targetPercent);
    const rewardWidth = Math.abs(points.entryPercent - points.targetPercent);

    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View
            style={[styles.directionBadge, isLong ? styles.directionBadgeLong : styles.directionBadgeShort]}
          >
            <Text
              style={[
                styles.directionBadgeText,
                isLong ? styles.directionBadgeTextLong : styles.directionBadgeTextShort,
              ]}
            >
              {directionLabel}
            </Text>
          </View>
          <View style={styles.rangeBadge}>
            <Text style={styles.rangeBadgeText}>{rangeLabel}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Risk-to-Stop</Text>
            <Text style={[styles.metricValue, styles.metricValueNegative]}>
              {formatSignedCurrency(riskValue)}
            </Text>
            <Text style={[styles.metricPercent, styles.metricPercentNegative]}>
              {formatSignedPercent(riskPercent)}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Reward-to-Target</Text>
            <Text style={[styles.metricValue, styles.metricValuePositive]}>
              {formatSignedCurrency(rewardValue)}
            </Text>
            <Text style={[styles.metricPercent, styles.metricPercentPositive]}>
              {formatSignedPercent(rewardPercent)}
            </Text>
          </View>
        </View>

        <View style={styles.trackCard}>
          <View style={styles.trackTopLabels}>
            <View style={styles.trackLabelRow}>
              <View style={[styles.trackTopCallout, { left: `${points.stopPercent}%` }]}>
                <Text style={styles.markerTitle}>Stop</Text>
                <Text style={[styles.markerValue, styles.stopText]}>{formatPrice(points.stop)}</Text>
              </View>
              <View style={[styles.trackTopCallout, { left: `${points.targetPercent}%` }]}>
                <Text style={styles.markerTitle}>Target</Text>
                <Text style={[styles.markerValue, styles.targetText]}>{formatPrice(points.target)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.trackLineArea}>
            <View style={styles.trackLine}>
              <View
                style={[styles.connector, styles.connectorTop, { left: `${points.stopPercent}%` }]}
              />
              <View
                style={[styles.connector, styles.connectorTop, { left: `${points.targetPercent}%` }]}
              />
              <View
                style={[
                  styles.connector,
                  styles.connectorBottom,
                  { left: `${points.entryPercent}%` },
                ]}
              />
              <View style={styles.trackBase} />
              {riskWidth > 0 ? (
                <View
                  style={[
                    styles.trackSegment,
                    styles.trackSegmentNegative,
                    { left: `${riskStart}%`, width: `${riskWidth}%` },
                  ]}
                />
              ) : null}
              {rewardWidth > 0 ? (
                <View
                  style={[
                    styles.trackSegment,
                    styles.trackSegmentPositive,
                    { left: `${rewardStart}%`, width: `${rewardWidth}%` },
                  ]}
                />
              ) : null}
              <View
                accessibilityLabel="Stop price marker"
                pointerEvents="none"
                style={[styles.trackDot, styles.stopDot, { left: `${points.stopPercent}%` }]}
              />
              <View
                accessibilityLabel="Entry price marker"
                pointerEvents="none"
                style={[styles.trackDot, styles.entryDot, { left: `${points.entryPercent}%` }]}
              />
              <View
                accessibilityLabel="Target price marker"
                pointerEvents="none"
                style={[styles.trackDot, styles.targetDot, { left: `${points.targetPercent}%` }]}
              />
            </View>
          </View>

          <View style={styles.trackBottomLabels}>
            <View style={styles.trackLabelRow}>
              <View style={[styles.trackBottomCallout, { left: `${points.entryPercent}%` }]}>
                <Text style={styles.markerTitle}>Entry</Text>
                <Text style={[styles.markerValue, styles.entryText]}>{formatPrice(points.entry)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>Min: {formatPrice(points.min)}</Text>
          <Text style={styles.rangeLabel}>Max: {formatPrice(points.max)}</Text>
        </View>

        <Text style={styles.disclaimer}>
          This profile is based on the current market data. Prices are indicative and may vary.
        </Text>
      </View>
    );
  },
);

RiskVisualization.displayName = 'RiskVisualization';

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  directionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  directionBadgeLong: {
    backgroundColor: '#DCFCE7',
  },
  directionBadgeShort: {
    backgroundColor: '#FEE2E2',
  },
  directionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  directionBadgeTextLong: {
    color: '#15803D',
  },
  directionBadgeTextShort: {
    color: '#B91C1C',
  },
  rangeBadge: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  rangeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 6,
  },
  metricLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricValueNegative: {
    color: '#DC2626',
  },
  metricValuePositive: {
    color: '#16A34A',
  },
  metricPercent: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricPercentNegative: {
    color: '#DC2626',
  },
  metricPercentPositive: {
    color: '#16A34A',
  },
  trackCard: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  trackTopLabels: {
    marginBottom: 12,
  },
  trackLabelRow: {
    position: 'relative',
    height: 36,
    marginHorizontal: 16,
  },
  trackTopCallout: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
    gap: 4,
    transform: [{ translateX: -40 }],
  },
  trackLineArea: {
    paddingHorizontal: 16,
  },
  trackLine: {
    position: 'relative',
    height: 64,
    justifyContent: 'center',
  },
  trackBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -4,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  trackSegment: {
    position: 'absolute',
    top: '50%',
    marginTop: -4,
    height: 8,
    borderRadius: 4,
  },
  trackSegmentNegative: {
    backgroundColor: '#EF4444',
  },
  trackSegmentPositive: {
    backgroundColor: '#22C55E',
  },
  connector: {
    position: 'absolute',
    borderStyle: 'dotted',
    borderLeftWidth: 1,
    borderColor: '#94A3B8',
    transform: [{ translateX: -0.5 }],
  },
  connectorTop: {
    top: '50%',
    height: 36,
    marginTop: -36,
  },
  connectorBottom: {
    top: '50%',
    height: 36,
  },
  trackDot: {
    position: 'absolute',
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    transform: [{ translateX: -7 }],
  },
  stopDot: {
    backgroundColor: '#EF4444',
  },
  entryDot: {
    backgroundColor: '#2563EB',
  },
  targetDot: {
    backgroundColor: '#22C55E',
  },
  trackBottomLabels: {
    marginTop: 12,
  },
  trackBottomCallout: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
    gap: 4,
    transform: [{ translateX: -40 }],
  },
  markerTitle: {
    fontSize: 12,
    color: '#64748B',
  },
  markerValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  stopText: {
    color: '#DC2626',
  },
  entryText: {
    color: '#2563EB',
  },
  targetText: {
    color: '#16A34A',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    fontSize: 13,
    color: '#475569',
  },
  disclaimer: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
});
