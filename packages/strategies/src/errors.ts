export class StrategyInputError
  extends Error {
  public constructor(
    message: string,
  ) {
    super(message);
    this.name =
      'StrategyInputError';
  }
}