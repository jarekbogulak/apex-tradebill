import {
  expectArraySchema,
  expectSchemaHasRequired,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isReferenceObject,
  isSchemaObject,
} from '../openapi';

const PATH = '/v1/trades/history/import';

describe('POST /v1/trades/history/import', () => {
  const operation = getOperationOrThrow(PATH, 'post');

  test('documents entries array payload referencing TradeInput/Output snapshots', () => {
    expect(operation.requestBody).toBeDefined();
    const body = operation.requestBody;
    if (!body || '$ref' in body) {
      throw new Error('Expected inline request body definition');
    }

    expect(body.required).toBe(true);
    const schema = body.content?.['application/json']?.schema;
    if (!schema || !isSchemaObject(schema)) {
      throw new Error('Expected inline schema for history import request');
    }

    expectSchemaHasRequired(schema, ['entries']);
    const entries = schema.properties?.entries;
    if (!isSchemaObject(entries)) {
      throw new Error('Expected entries array schema');
    }
    expect(entries.minItems).toBe(1);
    const entriesArray = expectArraySchema(entries, 'entries');
    if (!isSchemaObject(entriesArray.items)) {
      throw new Error('Expected entries array items to be inline object schemas');
    }

    const itemSchema = entriesArray.items;
    expectSchemaHasRequired(itemSchema, ['id', 'input', 'output', 'marketSnapshot', 'createdAt']);
    const { input, output, marketSnapshot } = itemSchema.properties ?? {};
    if (
      !isReferenceObject(input) ||
      !isReferenceObject(output) ||
      !isReferenceObject(marketSnapshot)
    ) {
      throw new Error('Expected input/output/marketSnapshot to reference shared schemas');
    }
    expect(input.$ref).toBe('#/components/schemas/TradeInput');
    expect(output.$ref).toBe('#/components/schemas/TradeOutput');
    expect(marketSnapshot.$ref).toBe('#/components/schemas/MarketSnapshot');
  });

  test('documents syncedIds response payload', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);
    expectSchemaHasRequired(schema, ['syncedIds']);
    const syncedIds = schema.properties?.syncedIds;
    if (!isSchemaObject(syncedIds)) {
      throw new Error('Expected syncedIds to be documented as an array');
    }
    const syncedArray = expectArraySchema(syncedIds, 'syncedIds');
    if (!isSchemaObject(syncedArray.items)) {
      throw new Error('Expected syncedIds array items to be inline schema objects');
    }
    expect(syncedArray.items.type).toBe('string');
  });

  test('documents validation errors', () => {
    const errorResponse = getResponseObjectOrThrow(operation, '400');
    const schema = errorResponse.content?.['application/json']?.schema;
    if (!schema || !isReferenceObject(schema)) {
      throw new Error('Expected error response schema to reference ErrorResponse');
    }
    expect(schema.$ref).toBe('#/components/schemas/ErrorResponse');
  });
});
