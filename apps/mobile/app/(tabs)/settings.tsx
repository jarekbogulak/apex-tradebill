import type { Timeframe } from '@apex-tradebill/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSettingsStore } from '@/src/state/settingsStore';
import { createApiClient } from '@/src/services/apiClient';

const COLORS = {
  textPrimary: '#0F172A',
  textMuted: '#475569',
  border: '#CBD5F5',
  accent: '#2563EB',
  textOnAccent: '#FFFFFF',
} as const;

const apiClient = createApiClient();
const TIMEFRAME_OPTIONS: Timeframe[] = ['1m', '5m', '15m'];

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const settings = useSettingsStore();
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
    onSuccess: (data) => {
      setSettings({
        riskPercent: data.riskPercent,
        atrMultiplier: data.atrMultiplier,
        dataFreshnessThresholdMs: data.dataFreshnessThresholdMs,
        defaultSymbol: data.defaultSymbol,
        defaultTimeframe: data.defaultTimeframe as typeof settings.defaultTimeframe,
        rememberedMultiplierOptions: data.rememberedMultiplierOptions,
        lastSyncedAt: new Date().toISOString(),
      });
    },
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: apiClient.updateSettings,
    onSuccess: async (data) => {
      setSettings({
        riskPercent: data.riskPercent,
        atrMultiplier: data.atrMultiplier,
        dataFreshnessThresholdMs: data.dataFreshnessThresholdMs,
        defaultSymbol: data.defaultSymbol,
        defaultTimeframe: data.defaultTimeframe as typeof settings.defaultTimeframe,
        rememberedMultiplierOptions: data.rememberedMultiplierOptions,
        lastSyncedAt: new Date().toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      setStatusMessage('Settings updated successfully');
    },
    onError: (error: Error) => {
      setStatusMessage(error.message);
    },
  });

  const handleSave = () => {
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
      {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  field: {
    gap: 4,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  timeframeGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  timeframeOption: {
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeOptionActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  timeframeOptionLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  timeframeOptionLabelActive: {
    color: COLORS.textOnAccent,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonLabel: {
    color: COLORS.textOnAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
