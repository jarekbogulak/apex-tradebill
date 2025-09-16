import React, { useMemo, useState } from 'react';
import { View, Text, Button, Alert, ScrollView } from 'react-native';
import Field from '@/components/Field';
import Stat from '@/components/Stat';
import { useTradeStore } from '@/state/useTradeStore';
import { useTicker } from '@/hooks/useApexPublic';
import { calcPositionSize } from '@/lib/position';
import { getWorstPrice, usePlaceOrder } from '@/hooks/useApexPrivate';

export default function TradeBillScreen() {
  const s = useTradeStore();
  const { data: tkr } = useTicker(s.symbol);
  const [placing, setPlacing] = useState(false);
  const placeOrder = usePlaceOrder();

  const entry = parseFloat(s.entry || tkr?.lastPrice || '0');
  const stop = parseFloat(s.stop || '0');
  const equity = parseFloat(s.equity || '0');
  const riskPct = parseFloat(s.riskPct || '0.01');

  const { size } = useMemo(() => calcPositionSize({ equity, riskPct, entry, stop }), [equity, riskPct, entry, stop]);
  const sizeStr = size ? size.toFixed(6) : '0';

  async function onGo() {
    try {
      setPlacing(true);
      // Use worst-price as required “market” price anchor
      const worst = await getWorstPrice({ symbolDash: s.symbolDash, side: s.side, size: sizeStr });
      const res = await placeOrder.mutateAsync({
        symbolDash: s.symbolDash,
        side: s.side,
        type: 'MARKET',
        size: sizeStr,
        price: String(worst || entry), // must be worse than index; worst-price fits
        timeInForce: 'IMMEDIATE_OR_CANCEL',
      });
      Alert.alert('Order Sent', JSON.stringify(res, null, 2));
    } catch (e: any) {
      Alert.alert('Order Error', e?.response?.data ? JSON.stringify(e.response.data) : String(e));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Trade Bill</Text>
      <Stat label="Live Last Price" value={tkr?.lastPrice ?? '-'} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="BUY" onPress={() => s.set({ side: 'BUY' })} color={s.side === 'BUY' ? '#3b82f6' : '#bbb'} />
        <Button title="SELL" onPress={() => s.set({ side: 'SELL' })} color={s.side === 'SELL' ? '#ef4444' : '#bbb'} />
      </View>

      <Field label="Symbol (no dash)" value={s.symbol} onChangeText={(v: string)=>s.set({symbol:v})}/>
      <Field label="Symbol (dash)" value={s.symbolDash} onChangeText={(v: string)=>s.set({symbolDash:v})}/>
      <Field label="Account Equity (USDT)" value={s.equity} onChangeText={(v: string)=>s.set({equity:v})}/>
      <Field label="Risk % (e.g., 0.01)" value={s.riskPct} onChangeText={(v: string)=>s.set({riskPct:v})}/>
      <Field label="Entry Price" value={s.entry} onChangeText={(v: string)=>s.set({entry:v})}/>
      <Field label="Stop Price" value={s.stop} onChangeText={(v: string)=>s.set({stop:v})}/>
      <Field label="Target Price" value={s.target} onChangeText={(v: string)=>s.set({target:v})}/>
      <Field label="Leverage (display only)" value={s.leverage} onChangeText={(v: string)=>s.set({leverage:v})}/>

      <Stat label="Shares / Contracts to Buy" value={sizeStr} />
      <Button title={placing ? 'Placing…' : 'Go'} onPress={onGo} disabled={placing || !size} />
      <Text style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>
        Note: ApeX “MARKET” requires a price and will reject if not worse than index price.
      </Text>
    </ScrollView>
  );
}

