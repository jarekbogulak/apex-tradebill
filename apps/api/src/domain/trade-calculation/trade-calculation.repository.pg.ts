import {
  TradeCalculationSchema,
  type TradeCalculation,
} from '@apex-tradebill/types';
import type { DatabasePool, QueryResultRow } from '../../infra/database/pool.js';
import type { TradeCalculationRepository } from './trade-calculation.entity.js';

interface TradeCalculationRow extends QueryResultRow {
  id: string;
  user_id: string;
  execution_method: string;
  executed_at: string | Date;
  input: unknown;
  output: unknown;
  market_snapshot: unknown;
  source: string;
  created_at: string | Date;
}

const toIsoString = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const mapRowToTradeCalculation = (row: TradeCalculationRow): TradeCalculation => {
  return TradeCalculationSchema.parse({
    id: row.id,
    userId: row.user_id,
    executionMethod: row.execution_method,
    executedAt: toIsoString(row.executed_at),
    input: row.input,
    output: row.output,
    marketSnapshot: row.market_snapshot,
    source: row.source,
    createdAt: toIsoString(row.created_at),
  });
};

const INSERT_TRADE_CALCULATION_SQL = `
  INSERT INTO trade_calculations (id, user_id, execution_method, executed_at, input, output, market_snapshot, source, created_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  ON CONFLICT (id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        execution_method = EXCLUDED.execution_method,
        executed_at = EXCLUDED.executed_at,
        input = EXCLUDED.input,
        output = EXCLUDED.output,
        market_snapshot = EXCLUDED.market_snapshot,
        source = EXCLUDED.source,
        created_at = EXCLUDED.created_at
  RETURNING id, user_id, execution_method, executed_at, input, output, market_snapshot, source, created_at;
`.trim();

export const createPostgresTradeCalculationRepository = (
  pool: DatabasePool,
): TradeCalculationRepository => {
  return {
    async findById(id) {
      const result = await pool.query<TradeCalculationRow>(
        `
          SELECT id, user_id, execution_method, executed_at, input, output, market_snapshot, source, created_at
          FROM trade_calculations
          WHERE id = $1;
        `,
        [id],
      );

      const row = result.rows[0];
      return row ? mapRowToTradeCalculation(row) : null;
    },
    async save(calculation) {
      const parsed = TradeCalculationSchema.parse(calculation);
      const result = await pool.query<TradeCalculationRow>(INSERT_TRADE_CALCULATION_SQL, [
        parsed.id,
        parsed.userId,
        parsed.executionMethod,
        parsed.executedAt,
        parsed.input,
        parsed.output,
        parsed.marketSnapshot,
        parsed.source,
        parsed.createdAt,
      ]);

      const row = result.rows[0];
      if (!row) {
        throw new Error('Failed to persist trade calculation');
      }
      return mapRowToTradeCalculation(row);
    },
    async listRecent(userId, limit, cursor) {
      const values: Array<string | number> = [userId, limit];
      let cursorClause = '';

      if (cursor) {
        values.push(cursor);
        cursorClause = 'AND created_at < $3';
      }

      const result = await pool.query<TradeCalculationRow>(
        `
          SELECT id, user_id, execution_method, executed_at, input, output, market_snapshot, source, created_at
          FROM trade_calculations
          WHERE user_id = $1
          ${cursorClause}
          ORDER BY created_at DESC
          LIMIT $2;
        `,
        values,
      );

      const items = result.rows.map(mapRowToTradeCalculation);
      const nextCursor =
        items.length === limit ? items[items.length - 1]?.createdAt ?? null : null;

      return {
        items,
        nextCursor,
      };
    },
  };
};
