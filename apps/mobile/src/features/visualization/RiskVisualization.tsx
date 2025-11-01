import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Direction } from '@apex-tradebill/types';
import { spacing } from '../trade-calculator/styles/tokens';

export interface RiskVisualizationProps {
  direction: Direction;
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string;
}

const TRACK_MARGIN_PERCENT = 8;
const ENTRY_BLUE = '#2563EB';

const COLORS = {
  directionLongBg: '#DCFCE7',
  directionShortBg: '#FEE2E2',
  directionLongText: '#15803D',
  directionShortText: '#B91C1C',
  rangeBadgeText: '#64748B',
  metricCardBg: '#FFFFFF',
  metricCardBorder: '#E2E8F0',
  metricCardNegativeBg: '#FEF2F2',
  metricCardNegativeBorder: '#FCA5A5',
  metricCardPositiveBg: '#ECFDF5',
  metricCardPositiveBorder: '#86EFAC',
  metricLabel: '#475569',
  metricNegative: '#DC2626',
  metricPositive: '#16A34A',
  trackBackground: '#F8FAFC',
  trackBorder: '#E2E8F0',
  trackBase: '#CBD5F5',
  trackNegative: '#EF4444',
  trackPositive: '#22C55E',
  connector: '#94A3B8',
  dotBorder: '#FFFFFF',
  dotShadow: '#0F172A',
  markerText: '#64748B',
  shadowNone: 'transparent',
} as const;

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
          <View style={[styles.metricCard, styles.metricCardNegative]}>
            <Text style={styles.metricLabel}>Risk to Stop</Text>
            <Text
              style={[styles.metricValue, styles.metricValueNegative]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatSignedPercent(riskPercent)}
            </Text>
            <Text
              style={[styles.metricPercent, styles.metricPercentNegative]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatSignedCurrency(riskValue)}
            </Text>
          </View>
          <View style={[styles.metricCard, styles.metricCardPositive]}>
            <Text style={styles.metricLabel}>Reward to Target</Text>
            <Text
              style={[styles.metricValue, styles.metricValuePositive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatSignedPercent(rewardPercent)}
            </Text>
            <Text
              style={[styles.metricPercent, styles.metricPercentPositive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {formatSignedCurrency(rewardValue)}
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
    backgroundColor: COLORS.directionLongBg,
  },
  directionBadgeShort: {
    backgroundColor: COLORS.directionShortBg,
  },
  directionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  directionBadgeTextLong: {
    color: COLORS.directionLongText,
  },
  directionBadgeTextShort: {
    color: COLORS.directionShortText,
  },
    rangeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  rangeBadgeText: {
    fontSize: 12,
    color: COLORS.rangeBadgeText,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.metricCardBg,
      borderRadius: 10,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: 8,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  metricCardNegative: {
    backgroundColor: COLORS.metricCardNegativeBg,
    borderColor: COLORS.metricCardNegativeBorder,
  },
  metricCardPositive: {
    backgroundColor: COLORS.metricCardPositiveBg,
    borderColor: COLORS.metricCardPositiveBorder,
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.metricLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  metricValueNegative: {
    color: COLORS.metricNegative,
  },
  metricValuePositive: {
    color: COLORS.metricPositive,
  },
  metricPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricPercentNegative: {
    color: COLORS.metricNegative,
  },
  metricPercentPositive: {
    color: COLORS.metricPositive,
  },
  trackCard: {
    position: 'relative',
    paddingVertical: 20,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
    backgroundColor: COLORS.trackBase,
  },
  trackSegment: {
    position: 'absolute',
    top: '50%',
    marginTop: -4,
    height: 8,
    borderRadius: 4,
  },
  trackSegmentNegative: {
    backgroundColor: COLORS.trackNegative,
  },
  trackSegmentPositive: {
    backgroundColor: COLORS.trackPositive,
  },
  connector: {
    position: 'absolute',
    borderStyle: 'dotted',
    borderLeftWidth: 1,
    borderColor: COLORS.connector,
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
    borderColor: COLORS.dotBorder,
    shadowColor: COLORS.dotShadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    transform: [{ translateX: -7 }],
  },
  stopDot: {
    backgroundColor: COLORS.trackNegative,
  },
  entryDot: {
    backgroundColor: ENTRY_BLUE,
  },
  targetDot: {
    backgroundColor: COLORS.trackPositive,
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
    color: COLORS.markerText,
  },
  markerValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  stopText: {
    color: COLORS.metricNegative,
  },
  entryText: {
    color: ENTRY_BLUE,
  },
  targetText: {
    color: COLORS.metricPositive,
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.markerText,
    lineHeight: 16,
  },
});
