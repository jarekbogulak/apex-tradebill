import type { Direction } from '@apex-tradebill/types';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface RiskVisualizationProps {
  direction: Direction;
  entryPrice: string | null;
  stopPrice: string;
  targetPrice: string;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export const RiskVisualization = memo(
  ({ direction, entryPrice, stopPrice, targetPrice }: RiskVisualizationProps) => {
    const points = useMemo(() => {
      const entry = Number(entryPrice ?? 0);
      const stop = Number(stopPrice);
      const target = Number(targetPrice);
      const values = [entry, stop, target].filter((value) => Number.isFinite(value));

      if (values.length === 0) {
        return null;
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;

      const toPercent = (value: number) => clamp(((value - min) / span) * 100);

      return {
        entry,
        stop,
        target,
        entryPercent: toPercent(entry),
        stopPercent: toPercent(stop),
        targetPercent: toPercent(target),
        min,
        max,
      };
    }, [entryPrice, stopPrice, targetPrice]);

    if (!points) {
      return null;
    }

    const isLong = direction === 'long';

    return (
      <View style={styles.container}>
        <View style={styles.scale}>
          <View style={[styles.range, isLong ? styles.longRange : styles.shortRange]} />
          <View style={[styles.marker, styles.entryMarker, { left: `${points.entryPercent}%` }]}
            accessibilityLabel="Entry price marker"
          >
            <Text style={styles.markerLabel}>Entry
              {'\n'}
              {points.entry.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.marker, styles.stopMarker, { left: `${points.stopPercent}%` }]}
            accessibilityLabel="Stop price marker"
          >
            <Text style={styles.markerLabel}>Stop
              {'\n'}
              {points.stop.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.marker, styles.targetMarker, { left: `${points.targetPercent}%` }]}
            accessibilityLabel="Target price marker"
          >
            <Text style={styles.markerLabel}>Target
              {'\n'}
              {points.target.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.labels}>
          <Text style={styles.labelText}>Min: {points.min.toFixed(2)}</Text>
          <Text style={styles.labelText}>Max: {points.max.toFixed(2)}</Text>
        </View>
      </View>
    );
  },
);

RiskVisualization.displayName = 'RiskVisualization';

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    gap: 8,
  },
  scale: {
    position: 'relative',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A18',
  },
  range: {
    position: 'absolute',
    inset: 0,
    opacity: 0.35,
  },
  longRange: {
    backgroundColor: '#16A34A',
  },
  shortRange: {
    backgroundColor: '#DC2626',
  },
  marker: {
    position: 'absolute',
    bottom: 0,
    transform: [{ translateX: -20 }],
    width: 80,
    padding: 4,
  },
  entryMarker: {
    backgroundColor: '#0F172A',
  },
  stopMarker: {
    backgroundColor: '#DC2626',
  },
  targetMarker: {
    backgroundColor: '#1D4ED8',
  },
  markerLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    textAlign: 'center',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelText: {
    color: '#334155',
    fontSize: 12,
  },
});
