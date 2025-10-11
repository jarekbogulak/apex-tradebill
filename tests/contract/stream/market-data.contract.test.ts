import type { OpenAPIV3_1 } from 'openapi-types';
import { expectSchemaHasRequired, getOperationOrThrow, getResponseObjectOrThrow, isParameterObject } from '../openapi.js';

const PATH = '/v1/stream/market-data';

const getWebSocketExtension = (operation: OpenAPIV3_1.OperationObject) => {
  const extension = (operation as Record<string, unknown>)['x-websocket'];
  if (!extension || typeof extension !== 'object') {
    throw new Error('Expected x-websocket extension to be defined for market data stream');
  }

  return extension as {
    message?: {
      payload?: OpenAPIV3_1.SchemaObject;
    };
  };
};

describe('GET /v1/stream/market-data (WebSocket)', () => {
  const operation = getOperationOrThrow(PATH, 'get');

  test('documents optional symbol list for subscription', () => {
    const parameters = (operation.parameters ?? []).filter(isParameterObject);
      const symbolsParameter = parameters.find((parameter: OpenAPIV3_1.ParameterObject) => parameter.name === 'symbols');

    expect(symbolsParameter).toBeDefined();
    if (!symbolsParameter) {
      return;
    }

    expect(symbolsParameter.in).toBe('query');

    const schema = symbolsParameter.schema;
    if (!schema || '$ref' in schema) {
      throw new Error('Expected symbols parameter schema to be defined inline');
    }

    if (schema.type !== 'array') {
      throw new Error('Expected symbols parameter to be documented as an array');
    }

    const itemSchema = schema.items;
    expect(itemSchema && '$ref' in (itemSchema as OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject)
      ? (itemSchema as OpenAPIV3_1.ReferenceObject).$ref
      : null).toBe('#/components/schemas/Symbol');
  });

  test('specifies WebSocket upgrade response', () => {
    const upgrading = getResponseObjectOrThrow(operation, '101');
    expect(upgrading.description?.toLowerCase()).toContain('websocket');
  });

  test('defines market snapshot payload for stream messages', () => {
    const extension = getWebSocketExtension(operation);
    const payloadSchema = extension.message?.payload;

    if (!payloadSchema) {
      throw new Error('Expected x-websocket message payload schema to be defined');
    }

    expect(payloadSchema.type).toBe('object');
    expectSchemaHasRequired(payloadSchema, ['type', 'data']);

    const properties = payloadSchema.properties ?? {};
    const typeProperty = properties.type;
    const dataProperty = properties.data;

    if (!typeProperty || '$ref' in typeProperty) {
      throw new Error('Expected message type property to be documented inline');
    }

    expect(typeProperty.type).toBe('string');
    expect(typeProperty.enum).toEqual(['market.snapshot']);

    expect(dataProperty && '$ref' in dataProperty ? dataProperty.$ref : null).toBe(
      '#/components/schemas/MarketSnapshot',
    );
  });
});
