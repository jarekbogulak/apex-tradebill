import { SymbolSchema, TimeframeSchema } from '@apex-tradebill/types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
  UpdateSettingsInput,
  UpdateUserSettingsUseCase,
} from '../../../../domain/settings/settings.usecases.js';
import {
  createErrorResponse,
  errorResponseSchema,
  resolveUserId,
  sendValidationError,
} from '../shared/http.js';
import { serializeSettings } from './serialize.js';

interface PatchSettingsRouteOptions {
  updateUserSettings: UpdateUserSettingsUseCase;
}

const SettingsPatchSchema = z
  .object({
    riskPercent: z.union([z.string(), z.number()]).optional(),
    atrMultiplier: z.union([z.string(), z.number()]).optional(),
    dataFreshnessThresholdMs: z.number().int().optional(),
    rememberedMultiplierOptions: z.array(z.union([z.string(), z.number()])).optional(),
    defaultSymbol: z.string().optional(),
    defaultTimeframe: z.string().optional(),
  })
  .strict();

const parseNumericField = (
  value: string | number | undefined,
  field: string,
  coerce: (numeric: number) => number = (numeric) => numeric,
): number | undefined => {
  if (value == null) {
    return undefined;
  }

  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    throw new Error(`${field} must be a valid number`);
  }

  return coerce(numeric);
};

export const patchSettingsRoute: FastifyPluginAsync<PatchSettingsRouteOptions> = async (
  app,
  { updateUserSettings },
) => {
  app.patch(
    '/v1/settings',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            riskPercent: { type: 'string' },
            atrMultiplier: { type: 'string' },
            dataFreshnessThresholdMs: { type: 'integer' },
            rememberedMultiplierOptions: {
              type: 'array',
              items: { type: 'string' },
            },
            defaultSymbol: { type: 'string' },
            defaultTimeframe: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: [
              'riskPercent',
              'atrMultiplier',
              'dataFreshnessThresholdMs',
              'defaultSymbol',
              'defaultTimeframe',
              'rememberedMultiplierOptions',
            ],
            properties: {
              riskPercent: { type: 'string' },
              atrMultiplier: { type: 'string' },
              dataFreshnessThresholdMs: { type: 'integer' },
              defaultSymbol: { type: 'string' },
              defaultTimeframe: { type: 'string' },
              rememberedMultiplierOptions: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parseResult = SettingsPatchSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map(
          (issue) => `${issue.path.join('.')} ${issue.message}`,
        );
        return sendValidationError(reply, 'Settings patch failed validation', details);
      }

      const {
        riskPercent,
        atrMultiplier,
        dataFreshnessThresholdMs,
        rememberedMultiplierOptions,
        defaultSymbol,
        defaultTimeframe,
      } = parseResult.data;

      try {
        const patch: UpdateSettingsInput = {};

        const parsedRiskPercent = parseNumericField(riskPercent, 'riskPercent');
        if (parsedRiskPercent != null) {
          patch.riskPercent = parsedRiskPercent;
        }

        const parsedAtrMultiplier = parseNumericField(atrMultiplier, 'atrMultiplier');
        if (parsedAtrMultiplier != null) {
          patch.atrMultiplier = parsedAtrMultiplier;
        }

        if (dataFreshnessThresholdMs != null) {
          patch.dataFreshnessThresholdMs = dataFreshnessThresholdMs;
        }

        if (rememberedMultiplierOptions) {
          patch.rememberedMultiplierOptions = rememberedMultiplierOptions.map((value, index) => {
            const numeric = parseNumericField(value, `rememberedMultiplierOptions[${index}]`);
            if (numeric == null) {
              throw new Error('Multiplier option must be numeric');
            }
            return numeric;
          });
        }

        if (defaultSymbol) {
          const symbolResult = SymbolSchema.safeParse(defaultSymbol);
          if (!symbolResult.success) {
            throw new Error('defaultSymbol must be a supported trading symbol');
          }
          patch.defaultSymbol = symbolResult.data;
        }

        if (defaultTimeframe) {
          const timeframeResult = TimeframeSchema.safeParse(defaultTimeframe);
          if (!timeframeResult.success) {
            throw new Error('defaultTimeframe must be a supported timeframe');
          }
          patch.defaultTimeframe = timeframeResult.data;
        }

        const userId = resolveUserId(request);
        const updated = await updateUserSettings(userId, patch);
        return reply.send(serializeSettings(updated));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update settings';
        return reply.status(400).send(createErrorResponse('SETTINGS_UPDATE_FAILED', message));
      }
    },
  );
};

export default patchSettingsRoute;
