import React from 'react';
import { View, Text } from 'react-native';

export default function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={{ fontSize: 12, opacity: 0.6 }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

