import {
  expectSchemaHasRequired,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isSchemaObject,
} from '../openapi.js';

const PATH = '/v1/accounts/equity';

describe('GET /v1/accounts/equity', () => {
  const operation = getOperationOrThrow(PATH, 'get');

  test('returns latest equity payload with source metadata', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);

    expect(schema.type).toBe('object');
    expectSchemaHasRequired(schema, ['source', 'equity', 'lastSyncedAt']);

    const properties = schema.properties ?? {};
    const sourceProperty = properties.source;
    const equityProperty = properties.equity;
    const lastSyncedAtProperty = properties.lastSyncedAt;

    if (!isSchemaObject(sourceProperty)) {
      throw new Error('Expected source property to be defined inline');
    }
    expect(sourceProperty.type).toBe('string');
    expect(sourceProperty.enum).toEqual(['connected', 'manual']);

    if (!isSchemaObject(equityProperty)) {
      throw new Error('Expected equity property to be defined inline');
    }
    expect(equityProperty.type).toBe('string');

    if (!isSchemaObject(lastSyncedAtProperty)) {
      throw new Error('Expected lastSyncedAt property to be defined inline');
    }
    expect(lastSyncedAtProperty.type).toBe('string');
    expect(lastSyncedAtProperty.format).toBe('date-time');
  });

  test('documents error payload when equity has not been established', () => {
    const notFound = getResponseObjectOrThrow(operation, '404');
    const media = notFound.content?.['application/json'];

    expect(media).toBeDefined();
    expect(media?.schema && '$ref' in media.schema ? media.schema.$ref : null).toBe(
      '#/components/schemas/ErrorResponse',
    );
  });
});
