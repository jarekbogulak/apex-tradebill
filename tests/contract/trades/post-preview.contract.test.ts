import type { OpenAPIV3_1 } from 'openapi-types';
import {
  expectArraySchema,
  expectSchemaHasRequired,
  getComponentSchemaOrThrow,
  getJsonSchemaFromResponseOrThrow,
  getOperationOrThrow,
  getResponseObjectOrThrow,
  isReferenceObject,
  isSchemaObject,
} from '../openapi';

const PATH = '/v1/trades/preview';

const isRequestBodyObject = (
  requestBody: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.RequestBodyObject | undefined,
): requestBody is OpenAPIV3_1.RequestBodyObject => Boolean(requestBody && !('$ref' in requestBody));

describe('POST /v1/trades/preview', () => {
  const operation = getOperationOrThrow(PATH, 'post');

  test('requires TradeInput payload for trade calculations', () => {
    expect(operation.requestBody).toBeDefined();
    if (!isRequestBodyObject(operation.requestBody)) {
      throw new Error('Expected request body to be defined inline for contract validation');
    }

    expect(operation.requestBody.required).toBe(true);

    const bodySchema = operation.requestBody.content?.['application/json']?.schema;
    expect(bodySchema && '$ref' in bodySchema ? bodySchema.$ref : null).toBe(
      '#/components/schemas/TradeInput',
    );
  });

  test('returns trade output and market snapshot payloads', () => {
    const response = getResponseObjectOrThrow(operation, '200');
    const schema = getJsonSchemaFromResponseOrThrow(response);

    expect(schema.type).toBe('object');
    expectSchemaHasRequired(schema, ['output', 'marketSnapshot']);

    const properties = schema.properties ?? {};
    const outputProperty = properties.output;
    const snapshotProperty = properties.marketSnapshot;
    const warningsProperty = properties.warnings;

    expect(outputProperty && '$ref' in outputProperty ? outputProperty.$ref : null).toBe(
      '#/components/schemas/TradeOutput',
    );
    expect(snapshotProperty && '$ref' in snapshotProperty ? snapshotProperty.$ref : null).toBe(
      '#/components/schemas/MarketSnapshot',
    );

    if (isSchemaObject(warningsProperty)) {
      const warningsArray = expectArraySchema(warningsProperty, 'warnings');
      const itemSchema = warningsArray.items;

      if (isReferenceObject(itemSchema)) {
        expect(itemSchema.$ref).toBe('#/components/schemas/TradeWarningCode');
      } else if (isSchemaObject(itemSchema)) {
        expect(itemSchema.type).toBe('string');
      } else {
        throw new Error('Expected warnings array items to be documented as schemas');
      }
    }
  });

  test('documents validation error response shape', () => {
    const errorResponse = getResponseObjectOrThrow(operation, '400');
    const media = errorResponse.content?.['application/json'];

    expect(media).toBeDefined();
    expect(media?.schema && '$ref' in media.schema ? media.schema.$ref : null).toBe(
      '#/components/schemas/ErrorResponse',
    );
  });

  test('documents stop price as optional when volatility stop is enabled', () => {
    const tradeInputSchema = getComponentSchemaOrThrow('TradeInput');
    expect(tradeInputSchema.required ?? []).not.toContain('stopPrice');

    const properties = tradeInputSchema.properties ?? {};
    const stopSchema = properties.stopPrice;

    if (isSchemaObject(stopSchema)) {
      expect((stopSchema as { nullable?: boolean }).nullable).toBe(true);
    } else {
      throw new Error('Expected stopPrice property to be defined inline for schema validation');
    }
  });
});
