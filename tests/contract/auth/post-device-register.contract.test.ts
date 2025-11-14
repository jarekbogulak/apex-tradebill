import {
  expectSchemaHasRequired,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isSchemaObject,
} from '../openapi';

const PATH = '/v1/auth/device/register';

describe('POST /v1/auth/device/register', () => {
  const operation = getOperationOrThrow(PATH, 'post');

  test('requires deviceId and activationCode in the request body', () => {
    expect(operation.requestBody).toBeDefined();
    const body = operation.requestBody;
    if (!body || '$ref' in body) {
      throw new Error('Expected inline request body definition');
    }

    expect(body.required).toBe(true);
    const schema = body.content?.['application/json']?.schema;
    if (!schema || !isSchemaObject(schema)) {
      throw new Error('Expected inline schema for device registration request');
    }

    expectSchemaHasRequired(schema, ['deviceId', 'activationCode']);
    expect(schema.properties?.deviceId?.type).toBe('string');
    expect(schema.properties?.activationCode?.type).toBe('string');
  });

  test('returns user/device identifiers plus a JWT and expiry timestamp', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);

    expectSchemaHasRequired(schema, ['userId', 'deviceId', 'token', 'tokenExpiresAt']);
    expect(schema.properties?.userId?.format).toBe('uuid');
    expect(schema.properties?.tokenExpiresAt?.format).toBe('date-time');
  });

  test('documents validation and expiry error responses', () => {
    for (const status of ['400', '403']) {
      const response = getResponseObjectOrThrow(operation, status);
      const schema = response.content?.['application/json']?.schema;
      if (!schema || !('$ref' in schema)) {
        throw new Error(`Expected ${status} response schema to reference ErrorResponse`);
      }
      expect(schema.$ref).toBe('#/components/schemas/ErrorResponse');
    }
  });
});
