import type { Timeframe } from '@apex-tradebill/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme, type Theme } from '@apex-tradebill/ui';
import { useSettingsStore } from '@/src/state/settingsStore';
import { createApiClient } from '@/src/services/apiClient';
import { formatFriendlyError } from '@/src/utils/api-error';

type StatusState =
  | {
      type: 'success';
      message: string;
    }
  | {
      type: 'error';
      message: string;
    };

const apiClient = createApiClient();
const TIMEFRAME_OPTIONS: Timeframe[] = ['1m', '5m', '15m'];
const DEFAULT_ERROR_MESSAGE = 'Unable to save settings. Please try again.';

const toFriendlySettingsError = (message: string): string => {
  if (/rememberedMultiplierOptions/i.test(message)) {
    return 'Multiplier presets must be numbers separated by commas (e.g., 1.5, 2, 3).';
  }
  if (/riskPercent/i.test(message)) {
    return 'Risk percent must be a valid number.';
  }
  if (/atrMultiplier/i.test(message)) {
    return 'ATR multiplier must be a valid number.';
  }
  if (/dataFreshnessThresholdMs/i.test(message)) {
    return 'Freshness threshold must be a whole number of milliseconds.';
  }
  return message;
};

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const settings = useSettingsStore();
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [status, setStatus] = useState<StatusState | null>(null);

  const { data: remoteSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
    staleTime: 30000,
  });

  useEffect(() => {
    if (remoteSettings) {
      setSettings({
        riskPercent: remoteSettings.riskPercent,
        atrMultiplier: remoteSettings.atrMultiplier,
        dataFreshnessThresholdMs: remoteSettings.dataFreshnessThresholdMs,
        defaultSymbol: remoteSettings.defaultSymbol,
        defaultTimeframe: remoteSettings.defaultTimeframe as Timeframe,
        rememberedMultiplierOptions: remoteSettings.rememberedMultiplierOptions,
        lastSyncedAt: new Date().toISOString(),
      });
    }
  }, [remoteSettings, setSettings]);

  const updateMutation = useMutation({
    mutationFn: apiClient.updateSettings,
    onSuccess: async (data) => {
      setSettings({
        riskPercent: data.riskPercent,
        atrMultiplier: data.atrMultiplier,
        dataFreshnessThresholdMs: data.dataFreshnessThresholdMs,
        defaultSymbol: data.defaultSymbol,
        defaultTimeframe: data.defaultTimeframe as Timeframe,
        rememberedMultiplierOptions: data.rememberedMultiplierOptions,
        lastSyncedAt: new Date().toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      setStatus({
        type: 'success',
        message: 'Settings updated successfully',
      });
    },
    onError: (error: Error) => {
      const friendly = formatFriendlyError(error, DEFAULT_ERROR_MESSAGE);
      setStatus({
        type: 'error',
        message: toFriendlySettingsError(friendly),
      });
    },
  });

  useEffect(() => {
    if (!status) return;

    const timeoutId = setTimeout(() => {
      setStatus(null);
    }, 4000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      return () => setStatus(null);
    }, []),
  );

  const handleSave = () => {
    setStatus(null);
    updateMutation.mutate({
      riskPercent: settings.riskPercent,
      atrMultiplier: settings.atrMultiplier,
      dataFreshnessThresholdMs: settings.dataFreshnessThresholdMs,
      defaultTimeframe: settings.defaultTimeframe,
      rememberedMultiplierOptions: settings.rememberedMultiplierOptions,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Risk Defaults</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Risk Percent</Text>
        <TextInput
          value={settings.riskPercent}
          keyboardType="decimal-pad"
          onChangeText={(value) => setSettings({ riskPercent: value })}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>ATR Multiplier</Text>
        <TextInput
          value={settings.atrMultiplier}
          keyboardType="decimal-pad"
          onChangeText={(value) => setSettings({ atrMultiplier: value })}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Default Timeframe</Text>
        <View style={styles.timeframeGroup}>
          {TIMEFRAME_OPTIONS.map((option) => {
            const isActive = settings.defaultTimeframe === option;
            return (
              <Pressable
                key={option}
                onPress={() => setSettings({ defaultTimeframe: option })}
                style={[styles.timeframeOption, isActive && styles.timeframeOptionActive]}
              >
                <Text
                  style={[
                    styles.timeframeOptionLabel,
                    isActive && styles.timeframeOptionLabelActive,
                  ]}
                >
                  {option.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Freshness Threshold (ms)</Text>
        <TextInput
          value={String(settings.dataFreshnessThresholdMs)}
          keyboardType="number-pad"
          onChangeText={(value) => setSettings({ dataFreshnessThresholdMs: Number(value) })}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Multiplier Presets (comma separated)</Text>
        <TextInput
          value={settings.rememberedMultiplierOptions.join(', ')}
          onChangeText={(value) => {
            const next = value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            setSettings({ rememberedMultiplierOptions: next });
          }}
          style={styles.input}
        />
      </View>
      <Pressable style={styles.button} onPress={handleSave} disabled={updateMutation.isPending}>
        <Text style={styles.buttonLabel}>
          {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
        </Text>
      </Pressable>
      {status ? (
        <View
          style={[
            styles.statusContainer,
            status.type === 'success' ? styles.statusSuccess : styles.statusError,
          ]}
        >
          <Text
            style={[
              styles.statusMessage,
              status.type === 'success' ? styles.statusSuccessText : styles.statusErrorText,
            ]}
          >
            {status.message}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
      backgroundColor: theme.colors.surfaceAlt,
      flexGrow: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    field: {
      gap: theme.spacing.xs,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      fontSize: 16,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
    },
    timeframeGroup: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    timeframeOption: {
      flexGrow: 1,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    timeframeOptionActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    timeframeOptionLabel: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    timeframeOptionLabelActive: {
      color: theme.colors.textInverted,
    },
    button: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.lg,
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    buttonLabel: {
      color: theme.colors.textInverted,
      fontSize: 16,
      fontWeight: '600',
    },
    statusContainer: {
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    statusSuccess: {
      backgroundColor: theme.colors.successSurface,
    },
    statusError: {
      backgroundColor: theme.colors.errorSurface,
    },
    statusMessage: {
      fontSize: 14,
    },
    statusSuccessText: {
      color: theme.colors.success,
    },
    statusErrorText: {
      color: theme.colors.error,
    },
  });
