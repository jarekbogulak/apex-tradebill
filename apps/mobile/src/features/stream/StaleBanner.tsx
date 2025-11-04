import type { FC } from 'react';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StreamStatus } from './useMarketStream.js';

export interface StaleBannerProps {
  status: StreamStatus;
  reconnectAttempts: number;
  lastUpdatedAt: number | null;
  onReconnect: () => void;
}

const COLORS = {
  staleBackground: '#fff4cd',
  disconnectedBackground: '#ffe1e0',
  textPrimary: '#1d1d20',
  textSecondary: '#3b3b40',
  buttonBackground: '#1d1d20',
  buttonText: '#ffffff',
} as const;

const formatElapsed = (lastUpdatedAt: number | null): string => {
  if (!lastUpdatedAt) {
    return 'Last update time unknown.';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
  if (seconds < 60) {
    return `Last update ${seconds}s ago.`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `Last update ${minutes}m${remainingSeconds}s ago.`;
};

const StaleBanner: FC<StaleBannerProps> = ({
  status,
  reconnectAttempts,
  lastUpdatedAt,
  onReconnect,
}) => {
  const visible = status === 'stale' || status === 'disconnected';
  const connecting = status === 'connecting';

  const message = useMemo(() => {
    if (status === 'stale') {
      return 'Live data paused. Displaying last known values.';
    }
    if (status === 'disconnected') {
      return 'Connection lost. Reconnect to resume live updates.';
    }
    return null;
  }, [status]);

  if (!visible || !message) {
    return null;
  }

  const elapsedText = formatElapsed(lastUpdatedAt);

  return (
    <View
      style={[styles.container, status === 'stale' ? styles.stale : styles.disconnected]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID="stream-stale-banner"
    >
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {status === 'stale' ? 'Data Stale' : 'Stream Disconnected'}
        </Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.elapsed}>{elapsedText}</Text>
        {reconnectAttempts > 0 ? (
          <Text style={styles.attempts}>Reconnect attempt {reconnectAttempts}</Text>
        ) : null}
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onReconnect}
        disabled={connecting}
        accessibilityRole="button"
        accessibilityLabel="Reconnect to market data stream"
        testID="stream-reconnect-button"
      >
        <Text style={styles.buttonLabel}>{connecting ? 'Reconnecting…' : 'Reconnect'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 16,
  },
  stale: {
    backgroundColor: COLORS.staleBackground,
  },
  disconnected: {
    backgroundColor: COLORS.disconnectedBackground,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  elapsed: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  attempts: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.buttonBackground,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonLabel: {
    color: COLORS.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StaleBanner;
