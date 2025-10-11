import type { OpenAPIV3_1 } from 'openapi-types';
import {
  expectArraySchema,
  expectSchemaHasRequired,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isParameterObject,
  isSchemaObject,
} from '../openapi';

const PATH = '/v1/trades/history';

const getSchemaRef = (
  schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject | undefined,
) => {
  if (!schema) {
    return null;
  }

  return '$ref' in schema ? schema.$ref : null;
};

describe('GET /v1/trades/history', () => {
  const operation = getOperationOrThrow(PATH, 'get');

  test('documents pagination parameters with bounds', () => {
    const parameters = (operation.parameters ?? []).filter(isParameterObject);
    const limitParameter = parameters.find((parameter) => parameter.name === 'limit');
    const cursorParameter = parameters.find((parameter) => parameter.name === 'cursor');

    expect(limitParameter).toBeDefined();
    expect(cursorParameter).toBeDefined();

    if (limitParameter) {
      expect(limitParameter.in).toBe('query');
      expect(limitParameter.required).not.toBe(true);
      const schema = limitParameter.schema;
      if (isSchemaObject(schema)) {
        expect(schema.type).toBe('integer');
        expect(schema.minimum).toBe(1);
        expect(schema.maximum).toBe(100);
        expect(schema.default).toBe(20);
      } else {
        throw new Error('Expected limit parameter schema to be defined inline');
      }
    }

    if (cursorParameter) {
      expect(cursorParameter.in).toBe('query');
      const schema = cursorParameter.schema;
      if (isSchemaObject(schema)) {
        expect(schema.type).toBe('string');
        expect((schema as { nullable?: boolean }).nullable).toBe(true);
      } else {
        throw new Error('Expected cursor parameter schema to be defined inline');
      }
    }
  });

  test('returns trade calculations array with optional pagination cursor', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);

    expect(schema.type).toBe('object');
    expectSchemaHasRequired(schema, ['items']);

    const properties = schema.properties ?? {};
    const itemsProperty = properties.items;
    const nextCursorProperty = properties.nextCursor;

    if (!isSchemaObject(itemsProperty)) {
      throw new Error('Expected items property to be an array schema');
    }

    const itemsArray = expectArraySchema(itemsProperty, 'items');
    const itemSchema = itemsArray.items;
    expect(getSchemaRef(itemSchema)).toBe('#/components/schemas/TradeCalculation');

    if (isSchemaObject(nextCursorProperty)) {
      expect(nextCursorProperty.type).toBe('string');
      expect((nextCursorProperty as { nullable?: boolean }).nullable).toBe(true);
    }
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
