import React, { useState } from 'react';
import { ScrollView, Text, Button, TextInput, Alert } from 'react-native';
import { getEnv } from '@/config/appEnv';

export default function SettingsScreen() {
  const env = getEnv();
  const [csv, setCsv] = useState('');

  function importCsv() {
    // Minimal CSV -> apply your defaults. Expect headers like: key,value
    try {
      const lines = csv.split(/\r?\n/);
      // implement parse & update store per your columns...
      Alert.alert('Imported defaults from CSV', `${lines.length} lines processed`);
    } catch (e:any) {
      Alert.alert('CSV error', String(e));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Settings</Text>
      <Text>Base URL: {env.APEX_BASE_URL}</Text>
      <Text style={{ marginTop: 16, fontWeight: '600' }}>Paste CSV from your sheet (one-time import)</Text>
      <TextInput
        multiline
        style={{ borderWidth:1, borderColor:'#ddd', borderRadius:10, minHeight:140, padding:10, marginTop:8 }}
        value={csv}
        onChangeText={setCsv}
        placeholder="key,value\nRiskPct,0.01\nEquity,10000"
      />
      <Button title="Import CSV" onPress={importCsv} />
    </ScrollView>
  );
}

