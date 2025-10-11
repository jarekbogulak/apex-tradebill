import { SymbolSchema, TimeframeSchema } from '@apex-tradebill/types';
import { z } from 'zod';

const now = () => new Date().toISOString();

const PercentSchema = z
  .number()
  .gt(0, 'Risk percent must be greater than zero')
  .lte(1, 'Risk percent cannot exceed 100%');

const MultiplierSchema = z
  .number()
  .gte(0.5, 'ATR multiplier must be at least 0.5')
  .lte(3, 'ATR multiplier cannot exceed 3.0');

const FreshnessSchema = z
  .number()
  .int()
  .gte(1000, 'Freshness threshold must be at least 1000ms')
  .lte(5000, 'Freshness threshold must be at most 5000ms');

export const UserSettingsSchema = z.object({
  userId: z.string().uuid(),
  riskPercent: PercentSchema,
  atrMultiplier: MultiplierSchema,
  dataFreshnessThresholdMs: FreshnessSchema,
  defaultSymbol: SymbolSchema,
  defaultTimeframe: TimeframeSchema,
  rememberedMultiplierOptions: z.array(MultiplierSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export interface NewUserSettingsInput {
  userId: string;
  riskPercent?: number;
  atrMultiplier?: number;
  dataFreshnessThresholdMs?: number;
  defaultSymbol: string;
  defaultTimeframe?: z.infer<typeof TimeframeSchema>;
  rememberedMultiplierOptions?: number[];
  createdAt?: string;
  updatedAt?: string;
}

const dedupeAndSort = (values: number[]): number[] => {
  return Array.from(new Set(values)).sort((a, b) => a - b);
};

export const DEFAULT_RISK_PERCENT = 0.02;
export const DEFAULT_ATR_MULTIPLIER = 1.5;
export const DEFAULT_FRESHNESS_MS = 2000;
export const DEFAULT_TIMEFRAME: z.infer<typeof TimeframeSchema> = '15m';

export const createUserSettings = (input: NewUserSettingsInput): UserSettings => {
  const issuedAt = input.createdAt ?? now();
  const atrMultiplier = input.atrMultiplier ?? DEFAULT_ATR_MULTIPLIER;

  const remembered = dedupeAndSort([
    atrMultiplier,
    ...(input.rememberedMultiplierOptions ?? []),
  ]);

  return UserSettingsSchema.parse({
    userId: input.userId,
    riskPercent: input.riskPercent ?? DEFAULT_RISK_PERCENT,
    atrMultiplier,
    dataFreshnessThresholdMs: input.dataFreshnessThresholdMs ?? DEFAULT_FRESHNESS_MS,
    defaultSymbol: input.defaultSymbol,
    defaultTimeframe: input.defaultTimeframe ?? DEFAULT_TIMEFRAME,
    rememberedMultiplierOptions: remembered,
    createdAt: issuedAt,
    updatedAt: input.updatedAt ?? issuedAt,
  });
};

export interface UpdateUserSettingsInput {
  riskPercent?: number;
  atrMultiplier?: number;
  dataFreshnessThresholdMs?: number;
  rememberedMultiplierOptions?: number[];
  defaultSymbol?: string;
  defaultTimeframe?: z.infer<typeof TimeframeSchema>;
  updatedAt?: string;
}

export const updateUserSettings = (
  settings: UserSettings,
  updates: UpdateUserSettingsInput,
): UserSettings => {
  const atrMultiplier = updates.atrMultiplier ?? settings.atrMultiplier;
  const remembered =
    updates.rememberedMultiplierOptions != null
      ? dedupeAndSort([atrMultiplier, ...updates.rememberedMultiplierOptions])
      : settings.rememberedMultiplierOptions;

  return UserSettingsSchema.parse({
    ...settings,
    ...updates,
    atrMultiplier,
    rememberedMultiplierOptions: remembered,
    updatedAt: updates.updatedAt ?? now(),
  });
};

export interface UserSettingsRepository {
  findByUserId(userId: string): Promise<UserSettings | null>;
  save(settings: UserSettings): Promise<UserSettings>;
}

export const createInMemoryUserSettingsRepository = (
  seed: UserSettings[] = [],
): UserSettingsRepository => {
  const settingsByUser = new Map<string, UserSettings>(seed.map((entry) => [entry.userId, entry]));

  return {
    async findByUserId(userId) {
      return settingsByUser.get(userId) ?? null;
    },
    async save(settings) {
      const parsed = UserSettingsSchema.parse(settings);
      settingsByUser.set(parsed.userId, parsed);
      return parsed;
    },
  };
};
