import type { Direction } from '@apex-tradebill/types';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';

import { useTheme, type Theme } from '@apex-tradebill/ui';

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
const formatSignedPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export const RiskVisualization = memo(
  ({ direction, entryPrice, stopPrice, targetPrice }: RiskVisualizationProps) => {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
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
            style={[
              styles.directionBadge,
              isLong ? styles.directionBadgeLong : styles.directionBadgeShort,
            ]}
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
                <Text style={[styles.markerValue, styles.stopText]}>
                  {formatPrice(points.stop)}
                </Text>
              </View>
              <View style={[styles.trackTopCallout, { left: `${points.targetPercent}%` }]}>
                <Text style={styles.markerTitle}>Target</Text>
                <Text style={[styles.markerValue, styles.targetText]}>
                  {formatPrice(points.target)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.trackLineArea}>
            <View style={styles.trackLine}>
              <View
                style={[styles.connector, styles.connectorTop, { left: `${points.stopPercent}%` }]}
              />
              <View
                style={[
                  styles.connector,
                  styles.connectorTop,
                  { left: `${points.targetPercent}%` },
                ]}
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
                <Text style={[styles.markerValue, styles.entryText]}>
                  {formatPrice(points.entry)}
                </Text>
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

const createStyles = (theme: Theme) =>
  ({
    container: {
      marginVertical: theme.spacing.lg,
      gap: theme.spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    directionBadge: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.pill,
    },
    directionBadgeLong: {
      backgroundColor: theme.colors.successSurface,
    },
    directionBadgeShort: {
      backgroundColor: theme.colors.errorSurface,
    },
    directionBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    directionBadgeTextLong: {
      color: theme.colors.success,
    },
    directionBadgeTextShort: {
      color: theme.colors.error,
    },
    rangeBadge: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    rangeBadgeText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      flexWrap: 'wrap',
    },
    metricCard: {
      flex: 1,
      borderRadius: theme.radii.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.xs,
      borderWidth: 1,
    },
    metricCardNegative: {
      borderColor: theme.colors.surfaceMuted,
    },
    metricCardPositive: {
      borderColor: theme.colors.surfaceMuted,
    },
    metricLabel: {
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    metricValue: {
      fontSize: 22,
      fontWeight: '700',
    },
    metricValueNegative: {
      color: theme.colors.error,
    },
    metricValuePositive: {
      color: theme.colors.success,
    },
    metricPercent: {
      fontSize: 14,
      fontWeight: '600',
    },
    metricPercentNegative: {
      color: theme.colors.error,
    },
    metricPercentPositive: {
      color: theme.colors.success,
    },
    trackCard: {
      position: 'relative',
      paddingVertical: theme.spacing.xl,
    },
    trackTopLabels: {
      marginBottom: theme.spacing.sm + theme.spacing.xs,
    },
    trackLabelRow: {
      position: 'relative',
      height: 36,
      marginHorizontal: theme.spacing.lg,
    },
    trackTopCallout: {
      position: 'absolute',
      width: 80,
      alignItems: 'center',
      gap: theme.spacing.xs,
      transform: [{ translateX: -40 }],
    },
    trackLineArea: {
      paddingHorizontal: theme.spacing.lg,
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
      backgroundColor: theme.colors.divider,
    },
    trackSegment: {
      position: 'absolute',
      top: '50%',
      marginTop: -4,
      height: 8,
      borderRadius: 4,
    },
    trackSegmentNegative: {
      backgroundColor: theme.colors.error,
    },
    trackSegmentPositive: {
      backgroundColor: theme.colors.success,
    },
    connector: {
      position: 'absolute',
      borderStyle: 'dotted',
      borderLeftWidth: 1,
      borderColor: theme.colors.textMuted,
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
      borderColor: theme.colors.surface,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      transform: [{ translateX: -7 }],
    },
    stopDot: {
      backgroundColor: theme.colors.error,
    },
    entryDot: {
      backgroundColor: theme.colors.accent,
    },
    targetDot: {
      backgroundColor: theme.colors.success,
    },
    trackBottomLabels: {
      marginTop: theme.spacing.sm,
    },
    trackBottomCallout: {
      position: 'absolute',
      width: 80,
      alignItems: 'center',
      gap: theme.spacing.xs,
      transform: [{ translateX: -40 }],
    },
    markerTitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    markerValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    stopText: {
      color: theme.colors.error,
    },
    entryText: {
      color: theme.colors.accent,
    },
    targetText: {
      color: theme.colors.success,
    },
    disclaimer: {
      fontSize: 12,
      color: theme.colors.textMuted,
      lineHeight: 16,
    },
  }) as const;
