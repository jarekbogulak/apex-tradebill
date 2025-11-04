import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { OpenAPIV3_1 } from 'openapi-types';

const specFilePath = path.resolve(
  process.cwd(),
  '..',
  'specs/001-develop-apex-tradebill/contracts/openapi.yaml',
);

let cachedDocument: OpenAPIV3_1.Document | undefined;

export const loadOpenApiDocument = (): OpenAPIV3_1.Document => {
  if (!cachedDocument) {
    const fileContents = readFileSync(specFilePath, 'utf8');
    cachedDocument = parse(fileContents) as OpenAPIV3_1.Document;
  }

  return cachedDocument;
};

export const getPathItemOrThrow = (pathName: string): OpenAPIV3_1.PathItemObject => {
  const document = loadOpenApiDocument();
  const pathItem = document.paths?.[pathName];

  if (!pathItem) {
    throw new Error(`Expected path ${pathName} to exist in OpenAPI document`);
  }

  return pathItem;
};

type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

export const getOperationOrThrow = (
  pathName: string,
  method: HttpMethod,
): OpenAPIV3_1.OperationObject => {
  const pathItem = getPathItemOrThrow(pathName) as Record<string, unknown>;
  const operation = pathItem[method];

  if (!operation) {
    throw new Error(`Expected ${method.toUpperCase()} ${pathName} to exist in OpenAPI document`);
  }

  return operation as OpenAPIV3_1.OperationObject;
};

export const getComponentSchemaOrThrow = (schemaName: string): OpenAPIV3_1.SchemaObject => {
  const document = loadOpenApiDocument();
  const schema = document.components?.schemas?.[schemaName];

  if (!schema) {
    throw new Error(`Expected schema ${schemaName} to exist in OpenAPI document`);
  }

  return schema as OpenAPIV3_1.SchemaObject;
};

export const isReferenceObject = (
  value: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject | undefined,
): value is OpenAPIV3_1.ReferenceObject => {
  return Boolean(value && typeof value === 'object' && '$ref' in value);
};

export const isSchemaObject = (
  value: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject | undefined,
): value is OpenAPIV3_1.SchemaObject => {
  return Boolean(value && !('$ref' in (value ?? {})));
};

export const isParameterObject = (
  value: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject,
): value is OpenAPIV3_1.ParameterObject => {
  return Boolean(value && !('$ref' in value));
};

const arrayTypeIncludesArray = (type: OpenAPIV3_1.SchemaObject['type']) => {
  if (!type) {
    return false;
  }

  if (Array.isArray(type)) {
    return type.includes('array');
  }

  return type === 'array';
};

export const expectArraySchema = (
  schema: OpenAPIV3_1.SchemaObject,
  propertyName: string,
): OpenAPIV3_1.ArraySchemaObject => {
  if (!arrayTypeIncludesArray(schema.type)) {
    throw new Error(`Expected ${propertyName} to be documented as an array schema`);
  }

  const arraySchema = schema as OpenAPIV3_1.ArraySchemaObject;

  if (!arraySchema.items) {
    throw new Error(`Expected ${propertyName} array schema to define items`);
  }

  return arraySchema;
};

export const getResponseObjectOrThrow = (
  operation: OpenAPIV3_1.OperationObject,
  statusCode: string,
): OpenAPIV3_1.ResponseObject => {
  const response = operation.responses?.[statusCode];

  if (!response) {
    throw new Error(`Expected response ${statusCode} to exist`);
  }

  if ('$ref' in response) {
    throw new Error(
      `Response ${statusCode} should be an inline object, received $ref: ${response.$ref}`,
    );
  }

  return response;
};

export const getJsonSchemaFromResponseOrThrow = (
  response: OpenAPIV3_1.ResponseObject,
  mediaType = 'application/json',
): OpenAPIV3_1.SchemaObject => {
  const media = response.content?.[mediaType];

  if (!media) {
    throw new Error(`Expected media type ${mediaType} to be documented`);
  }

  if (!media.schema) {
    throw new Error(`Expected media type ${mediaType} to include a schema`);
  }

  if (isReferenceObject(media.schema)) {
    throw new Error(`Expected an inline schema but received $ref: ${media.schema.$ref}`);
  }

  return media.schema;
};

export const expectSchemaHasRequired = (schema: OpenAPIV3_1.SchemaObject, properties: string[]) => {
  expect(Array.isArray(schema.required)).toBe(true);
  for (const property of properties) {
    expect(schema.required).toContain(property);
  }
};
