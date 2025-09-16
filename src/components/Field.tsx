import React from 'react';
import { View, Text, TextInput } from 'react-native';

type FieldProps = {
  label: string;
  value?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric' | 'email-address' | 'phone-pad';
  placeholder?: string;
};

export default function Field({ label, value, onChangeText, keyboardType = 'decimal-pad', placeholder }: FieldProps) {
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ fontSize: 12, opacity: 0.7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={{
          borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 10, fontSize: 16
        }}
      />
    </View>
  );
}
