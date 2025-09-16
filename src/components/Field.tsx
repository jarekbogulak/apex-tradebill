import React from 'react';
import { View, Text, TextInput } from 'react-native';

export default function Field({label, value, onChangeText, keyboardType='decimal-pad'}: any) {
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ fontSize: 12, opacity: 0.7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={{
          borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 10, fontSize: 16
        }}
      />
    </View>
  );
}

