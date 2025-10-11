import type { OpenAPIV3_1 } from 'openapi-types';
import {
  expectArraySchema,
  expectSchemaHasRequired,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isSchemaObject,
} from '../openapi';

const PATH = '/v1/settings';

const expectStringProperty = (
  schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject | undefined,
) => {
  if (!isSchemaObject(schema)) {
    throw new Error('Expected property to be an inline schema');
  }

  expect(schema.type).toBe('string');
};

describe('GET /v1/settings', () => {
  const operation = getOperationOrThrow(PATH, 'get');

  test('returns persisted calculator settings with defaults', () => {
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
    expectStringProperty(properties.riskPercent);
    expectStringProperty(properties.atrMultiplier);

    const freshnessProperty = properties.dataFreshnessThresholdMs;
    if (!isSchemaObject(freshnessProperty)) {
      throw new Error('Expected dataFreshnessThresholdMs to be an inline schema');
    }
    expect(freshnessProperty.type).toBe('integer');

    const defaultSymbolProperty = properties.defaultSymbol;
    const defaultTimeframeProperty = properties.defaultTimeframe;
    const rememberedOptionsProperty = properties.rememberedMultiplierOptions;

    expect(
      defaultSymbolProperty && '$ref' in defaultSymbolProperty ? defaultSymbolProperty.$ref : null,
    ).toBe('#/components/schemas/Symbol');

    expect(
      defaultTimeframeProperty && '$ref' in defaultTimeframeProperty ? defaultTimeframeProperty.$ref : null,
    ).toBe('#/components/schemas/Timeframe');

    if (!isSchemaObject(rememberedOptionsProperty)) {
      throw new Error('Expected rememberedMultiplierOptions to be documented as an array');
    }

    const rememberedOptionsArray = expectArraySchema(rememberedOptionsProperty, 'rememberedMultiplierOptions');
    const itemSchema = rememberedOptionsArray.items;
    expectStringProperty(itemSchema);
  });

  test('documents unauthorized response shape', () => {
    const unauthorized = getResponseObjectOrThrow(operation, '401');
    const media = unauthorized.content?.['application/json'];

    expect(media).toBeDefined();
    expect(media?.schema && '$ref' in media.schema ? media.schema.$ref : null).toBe(
      '#/components/schemas/ErrorResponse',
    );
  });
});
