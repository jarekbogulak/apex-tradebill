import type { OpenAPIV3_1 } from 'openapi-types';
import {
  expectArraySchema,
  expectSchemaHasRequired,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isSchemaObject,
} from '../openapi.js';

const PATH = '/v1/settings';

const ensureInlineRequestBody = (
  requestBody: OpenAPIV3_1.OperationObject['requestBody'],
): OpenAPIV3_1.RequestBodyObject => {
  if (!requestBody) {
    throw new Error('Expected request body to be defined');
  }

  if ('$ref' in requestBody) {
    throw new Error(`Expected inline request body schema, received reference: ${requestBody.$ref}`);
  }

  return requestBody;
};

describe('PATCH /v1/settings', () => {
  const operation = getOperationOrThrow(PATH, 'patch');

  test('accepts partial updates constrained to documented fields', () => {
    const requestBody = ensureInlineRequestBody(operation.requestBody);

    expect(requestBody.required).toBe(true);
    const media = requestBody.content?.['application/json'];
    if (!media) {
      throw new Error('Expected JSON request body to be documented');
    }

    const schema = media.schema;
    if (!isSchemaObject(schema)) {
      throw new Error('Expected request body schema to be defined inline');
    }

    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);

    const properties = schema.properties ?? {};
    expect(Object.keys(properties).sort()).toEqual(
      [
        'atrMultiplier',
        'dataFreshnessThresholdMs',
        'rememberedMultiplierOptions',
        'riskPercent',
      ].sort(),
    );

    const riskPercentProperty = properties.riskPercent;
    const atrMultiplierProperty = properties.atrMultiplier;
    const freshnessProperty = properties.dataFreshnessThresholdMs;
    const rememberedOptionsProperty = properties.rememberedMultiplierOptions;

    if (!isSchemaObject(riskPercentProperty)) {
      throw new Error('Expected riskPercent to be defined inline');
    }
    expect(riskPercentProperty.type).toBe('string');

    if (!isSchemaObject(atrMultiplierProperty)) {
      throw new Error('Expected atrMultiplier to be defined inline');
    }
    expect(atrMultiplierProperty.type).toBe('string');

    if (!isSchemaObject(freshnessProperty)) {
      throw new Error('Expected dataFreshnessThresholdMs to be defined inline');
    }
    expect(freshnessProperty.type).toBe('integer');

    if (!isSchemaObject(rememberedOptionsProperty)) {
      throw new Error('Expected rememberedMultiplierOptions to be documented as an array');
    }

    const rememberedOptionsArray = expectArraySchema(
      rememberedOptionsProperty,
      'rememberedMultiplierOptions',
    );
    const itemSchema = rememberedOptionsArray.items;
    if (!isSchemaObject(itemSchema)) {
      throw new Error(
        'Expected rememberedMultiplierOptions array items to be inline schema definitions',
      );
    }
    expect(itemSchema.type).toBe('string');
  });

  test('returns updated settings payload matching documented schema', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);

    expect(schema.type).toBe('object');
    expectSchemaHasRequired(schema, [
      'riskPercent',
      'atrMultiplier',
      'dataFreshnessThresholdMs',
      'defaultSymbol',
      'defaultTimeframe',
      'rememberedMultiplierOptions',
    ]);

    const properties = schema.properties ?? {};
    const riskPercent = properties.riskPercent;
    const atrMultiplier = properties.atrMultiplier;
    const freshness = properties.dataFreshnessThresholdMs;
    const defaultSymbol = properties.defaultSymbol;
    const defaultTimeframe = properties.defaultTimeframe;
    const rememberedOptions = properties.rememberedMultiplierOptions;

    if (!isSchemaObject(riskPercent)) {
      throw new Error('Expected riskPercent to be defined inline');
    }
    expect(riskPercent.type).toBe('string');

    if (!isSchemaObject(atrMultiplier)) {
      throw new Error('Expected atrMultiplier to be defined inline');
    }
    expect(atrMultiplier.type).toBe('string');

    if (!isSchemaObject(freshness)) {
      throw new Error('Expected dataFreshnessThresholdMs to be defined inline');
    }
    expect(freshness.type).toBe('integer');

    expect(defaultSymbol && '$ref' in defaultSymbol ? defaultSymbol.$ref : null).toBe(
      '#/components/schemas/Symbol',
    );
    expect(defaultTimeframe && '$ref' in defaultTimeframe ? defaultTimeframe.$ref : null).toBe(
      '#/components/schemas/Timeframe',
    );

    if (!isSchemaObject(rememberedOptions)) {
      throw new Error('Expected rememberedMultiplierOptions to be documented as an array');
    }

    const optionsArray = expectArraySchema(rememberedOptions, 'rememberedMultiplierOptions');
    const itemSchema = optionsArray.items;
    if (!isSchemaObject(itemSchema)) {
      throw new Error(
        'Expected rememberedMultiplierOptions array items to be inline schema definitions',
      );
    }
    expect(itemSchema.type).toBe('string');
  });

  test('documents validation error response payload', () => {
    const errorResponse = getResponseObjectOrThrow(operation, '400');
    const media = errorResponse.content?.['application/json'];

    expect(media).toBeDefined();
    expect(media?.schema && '$ref' in media.schema ? media.schema.$ref : null).toBe(
      '#/components/schemas/ErrorResponse',
    );
  });
});
