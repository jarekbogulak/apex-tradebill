type ApiErrorDetailsInput = string | string[] | null | undefined;

const sanitizeDetail = (detail: string): string | null => {
  const trimmed = detail.trim();
  if (!trimmed) {
    return null;
  }

  const [field, ...rest] = trimmed.split(/\s+/);
  if (rest.length === 0) {
    return trimmed;
  }

  const message = rest.join(' ').trim();
  if (message.length > 0) {
    return message;
  }

  return trimmed.replace(field, '').trim() || null;
};

const normalizeDetailValue = (value: unknown): string[] => {
  if (typeof value === 'string') {
    const sanitized = sanitizeDetail(value);
    return sanitized ? [sanitized] : [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? sanitizeDetail(item) : null))
      .filter((item): item is string => Boolean(item));
  }

  return [];
};

interface ApiErrorOptions {
  status: number;
  message?: string | null;
  code?: string | null;
  details?: ApiErrorDetailsInput | ApiErrorDetailsInput[];
  rawBody?: string;
  body?: unknown;
  url?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: string[];
  readonly rawBody: string | null;
  readonly body: unknown;
  readonly url: string | null;

  constructor({
    status,
    message,
    code,
    details,
    rawBody = null,
    body = null,
    url = null,
  }: ApiErrorOptions) {
    const fallback = `Request failed with status ${status}`;
    super(message?.trim() || fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? null;
    const detailValues = Array.isArray(details) ? details : [details];
    this.details = detailValues.flatMap((value) => normalizeDetailValue(value));
    this.rawBody = rawBody;
    this.body = body;
    this.url = url;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: ApiErrorDetailsInput | ApiErrorDetailsInput[];
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const buildApiError = ({
  status,
  bodyText,
  url,
}: {
  status: number;
  bodyText: string;
  url?: string;
}): ApiError => {
  const parsedBody = parseJson(bodyText);

  if (parsedBody && typeof parsedBody === 'object') {
    const payload = parsedBody as ApiErrorPayload;
    return new ApiError({
      status,
      code: payload.code ?? null,
      message: payload.message ?? null,
      details: payload.details,
      rawBody: bodyText,
      body: parsedBody,
      url,
    });
  }

  return new ApiError({
    status,
    message: bodyText,
    rawBody: bodyText,
    body: null,
    url,
  });
};

export const formatFriendlyError = (error: unknown, fallback: string): string => {
  if (!error) {
    return fallback;
  }

  const shouldFallbackForMessage = (message: string) =>
    [
      'ENOTFOUND',
      'ECONN',
      'ETIMEOUT',
      'EHOST',
      'ENET',
      'network request failed',
      'failed to fetch',
    ].some((needle) => message.toLowerCase().includes(needle.toLowerCase()));

  if (isApiError(error)) {
    if (error.details.length > 0) {
      return error.details.join('\n');
    }
    if (error.message.trim()) {
      return shouldFallbackForMessage(error.message) ? fallback : error.message;
    }
    return fallback;
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (!trimmed) {
      return fallback;
    }
    return shouldFallbackForMessage(trimmed) ? fallback : trimmed;
  }

  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (!trimmed) {
      return fallback;
    }
    return shouldFallbackForMessage(trimmed) ? fallback : trimmed;
  }

  return fallback;
};
