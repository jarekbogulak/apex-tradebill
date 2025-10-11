import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSettingsStore } from '@/src/state/settingsStore';
import { createApiClient } from '@/src/services/apiClient';

const apiClient = createApiClient();

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
        <Text style={styles.buttonLabel}>{updateMutation.isPending ? 'Saving…' : 'Save Settings'}</Text>
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
    color: '#0F172A',
  },
  field: {
    gap: 4,
  },
  label: {
    color: '#475569',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
  },
  button: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 13,
    color: '#475569',
  },
});
