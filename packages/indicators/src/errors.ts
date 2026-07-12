export class IndicatorInputError
  extends Error
{
  public constructor(message: string) {
    super(message);
    this.name = 'IndicatorInputError';
  }
}