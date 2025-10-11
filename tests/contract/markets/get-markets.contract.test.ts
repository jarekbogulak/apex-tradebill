import type { OpenAPIV3_1 } from 'openapi-types';
import {
  expectSchemaHasRequired,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isParameterObject,
  isSchemaObject,
} from '../openapi';

const PATH = '/v1/markets/{symbol}';

describe('GET /v1/markets/{symbol}', () => {
  const operation = getOperationOrThrow(PATH, 'get');

  test('documents the symbol path parameter referencing the Symbol schema', () => {
    const parameters = (operation.parameters ?? []).filter(isParameterObject);
    const symbolParam = parameters.find((parameter) => parameter.name === 'symbol');

    expect(symbolParam).toBeDefined();
    if (!symbolParam) {
      return;
    }

    expect(symbolParam.in).toBe('path');
    expect(symbolParam.required).toBe(true);
    expect(symbolParam.schema && '$ref' in symbolParam.schema ? symbolParam.schema.$ref : null).toBe(
      '#/components/schemas/Symbol',
    );
  });

  test('exposes symbol metadata including precision boundaries', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);

    expect(schema.type).toBe('object');
    expectSchemaHasRequired(schema, ['symbol', 'tickSize', 'stepSize', 'minNotional', 'minQuantity', 'status']);
    expect(schema.additionalProperties).toBeUndefined();

    const properties = schema.properties ?? {};
    const symbolProperty = properties.symbol;
    const statusProperty = properties.status;

    expect(symbolProperty && '$ref' in symbolProperty ? symbolProperty.$ref : null).toBe(
      '#/components/schemas/Symbol',
    );

    if (isSchemaObject(statusProperty)) {
      expect(statusProperty.enum).toEqual(['tradable', 'suspended']);
    } else {
      throw new Error('Expected status property to be defined inline with an enum');
    }
  });

  test('documents error payload when the symbol is missing or suspended', () => {
    const notFound = getResponseObjectOrThrow(operation, '404');
    const media = notFound.content?.['application/json'];

    expect(media).toBeDefined();
    expect(media?.schema && '$ref' in media.schema ? media.schema.$ref : null).toBe(
      '#/components/schemas/ErrorResponse',
    );
  });
});
