import { ApiError, buildApiError, formatFriendlyError } from '../api-error.js';

const FALLBACK = 'fallback message';

describe('ApiError', () => {
  test('normalizes details from string array payload', () => {
    const error = new ApiError({
      status: 400,
      message: 'Trade input failed validation',
      details: ['targetPrice Target price must be positive'],
    });

    expect(error.details).toEqual(['Target price must be positive']);
  });

  test('buildApiError parses structured payloads', () => {
    const jsonPayload =
      '{"code":"VALIDATION_ERROR","message":"Trade input failed validation","details":["targetPrice Target price must be positive"]}';

    const error = buildApiError({
      status: 400,
      bodyText: jsonPayload,
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(['Target price must be positive']);
  });
});

describe('formatFriendlyError', () => {
  test('prefers normalized details when available', () => {
    const error = new ApiError({
      status: 400,
      details: ['targetPrice Target price must be positive'],
    });

    const message = formatFriendlyError(error, FALLBACK);

    expect(message).toBe('Target price must be positive');
  });

  test('falls back to error message', () => {
    const error = new ApiError({
      status: 500,
      message: 'Something went wrong',
    });

    const message = formatFriendlyError(error, FALLBACK);

    expect(message).toBe('Something went wrong');
  });

  test('returns fallback when error is unknown', () => {
    const message = formatFriendlyError(null, FALLBACK);

    expect(message).toBe(FALLBACK);
  });

  test('returns fallback for network-level errors', () => {
    const message = formatFriendlyError(
      new Error('getaddrinfo ENOTFOUND db.enqupslnjmfnvqrtrycf.supabase.co'),
      FALLBACK,
    );

    expect(message).toBe(FALLBACK);
  });
});
