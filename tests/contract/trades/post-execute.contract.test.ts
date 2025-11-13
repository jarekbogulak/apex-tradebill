import {
  expectSchemaHasRequired,
  getComponentSchemaOrThrow,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isReferenceObject,
  isSchemaObject,
} from '../openapi';

const PATH = '/v1/trades/execute';

describe('POST /v1/trades/execute', () => {
  const operation = getOperationOrThrow(PATH, 'post');

  test('requires a TradeInput payload', () => {
    expect(operation.requestBody).toBeDefined();
    const body = operation.requestBody;
    if (!body || '$ref' in body) {
      throw new Error('Expected inline request body definition');
    }

    expect(body.required).toBe(true);
    const schema = body.content?.['application/json']?.schema;
    if (!schema) {
      throw new Error('Expected request body schema to be present');
    }

    expect(isReferenceObject(schema)).toBe(true);
    if (isReferenceObject(schema)) {
      expect(schema.$ref).toBe('#/components/schemas/TradeInput');
    }
  });

  test('returns calculation, output, snapshot, and warnings payloads', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);
    expectSchemaHasRequired(schema, ['calculation', 'output', 'marketSnapshot']);

    const { calculation, output, marketSnapshot, warnings } = schema.properties ?? {};

    if (!isReferenceObject(calculation) || !isReferenceObject(output) || !isReferenceObject(marketSnapshot)) {
      throw new Error('Expected calculation/output/marketSnapshot to reference shared schemas');
    }

    expect(calculation.$ref).toBe('#/components/schemas/TradeCalculation');
    expect(output.$ref).toBe('#/components/schemas/TradeOutput');
    expect(marketSnapshot.$ref).toBe('#/components/schemas/MarketSnapshot');

    if (!warnings || Array.isArray(warnings) || !('items' in warnings)) {
      throw new Error('Expected warnings schema to be documented as an array');
    }

    expect(warnings.type).toBe('array');
    const items = warnings.items;
    if (!items || Array.isArray(items)) {
      throw new Error('Expected warnings array to reference TradeWarningCode');
    }
    if (!isReferenceObject(items)) {
      throw new Error('Expected warnings array items to be a $ref');
    }
    expect(items.$ref).toBe('#/components/schemas/TradeWarningCode');
  });

  test('documents validation and not-found errors', () => {
    const badRequest = getResponseObjectOrThrow(operation, '400');
    const missing = getResponseObjectOrThrow(operation, '404');

    for (const response of [badRequest, missing]) {
      const schema = response.content?.['application/json']?.schema;
      if (!schema || !isReferenceObject(schema)) {
        throw new Error('Expected error response schema to reference ErrorResponse');
      }
      expect(schema.$ref).toBe('#/components/schemas/ErrorResponse');
    }
  });

  test('persists execution metadata in the TradeCalculation schema', () => {
    const tradeCalculation = getComponentSchemaOrThrow('TradeCalculation');
    expect(tradeCalculation.required).toEqual(
      expect.arrayContaining(['userId', 'executionMethod', 'executedAt']),
    );

    const properties = tradeCalculation.properties ?? {};
    const executionMethod = properties.executionMethod;

    if (!isSchemaObject(executionMethod)) {
      throw new Error('Expected executionMethod property to be defined');
    }

    expect(executionMethod.enum).toEqual(['execute-button', 'history-import']);
  });
});
