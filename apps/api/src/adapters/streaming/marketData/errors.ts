export class MarketDataUnavailableError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'MarketDataUnavailableError';
    this.details = details;
  }
}
