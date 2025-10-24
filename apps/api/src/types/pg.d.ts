declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
    rows: T[];
    rowCount: number;
  }

  export interface PoolClient {
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<T>>;
    release(error?: Error): void;
  }

  export interface PoolConfig {
    connectionString?: string;
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
    allowExitOnIdle?: boolean;
    ssl?: boolean | { rejectUnauthorized: boolean };
    application_name?: string;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: 'error', listener: (error: Error) => void): this;
  }
}

