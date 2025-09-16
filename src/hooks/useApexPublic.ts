import { useQuery } from '@tanstack/react-query';
import { httpPublic } from '@/lib/http';
import { getEnv } from '@/config/appEnv';

type TickerData = {
  symbol: string;
  lastPrice: string;
  markPrice: string;
  indexPrice: string;
};

export function useTicker(symbol = getEnv().DEFAULT_SYMBOL) {
  return useQuery({
    queryKey: ['ticker', symbol],
    queryFn: async () => {
        const { data } = await httpPublic.get('/v3/ticker', { params: { symbol } });
        const item = (data?.data?.[0] ?? data?.data ?? data?.result ?? data?.[0] ?? data) as any;
      const t: TickerData = {
          symbol: item?.symbol ?? item?.s ?? item?.pair ?? item?.contract,
          lastPrice: item?.lastPrice ?? item?.last ?? item?.lp ?? item?.price,
          markPrice: item?.markPrice ?? item?.mp ?? item?.mark,
          indexPrice: item?.indexPrice ?? item?.ip ?? item?.index,
      };
      return t;
    },
    refetchInterval: 4000,
  });
}
