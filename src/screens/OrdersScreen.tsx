import React, { useMemo } from 'react';
import { View, Text, FlatList, Button } from 'react-native';
import { useOrdersStore } from '@/state/useOrdersStore';

export default function OrdersScreen(){
  const orders = useOrdersStore((s) => s.orders);
  const clear = useOrdersStore((s) => s.clear);

  const data = useMemo(() => orders, [orders]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Orders</Text>
        <Button title="Clear" onPress={clear} />
      </View>
      {data.length === 0 ? (
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 16, opacity: 0.7 }}>No orders yet. Place one from Trade Bill.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, idx) => String(item.id || item.clientOrderId || item.createdAt || idx)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={{ borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>
                {item.side} {item.size} {item.symbolDash}
              </Text>
              <Text style={{ marginTop: 4 }}>Price: {item.price}</Text>
              <Text>Type: {item.type} · TIF: {item.timeInForce || '-'}</Text>
              <Text>ID: {item.id || item.clientOrderId || '-'}</Text>
              <Text style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
