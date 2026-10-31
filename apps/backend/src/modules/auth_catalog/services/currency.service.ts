import { prisma } from '../../../core/database/prisma.js';
import { NotFoundError, BadRequestError } from '../../../core/errors/appError.js';
import { logger } from '../../../core/logging/logger.js';

export class CurrencyService {
  /**
   * Lists all supported currencies and exchange rates
   */
  async listCurrencies() {
    const currencies = await prisma.currency.findMany({
      orderBy: { isBaseCurrency: 'desc' },
    });
    return currencies.map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      exchangeRateToBase: Number(c.exchangeRateToBase),
      isBaseCurrency: c.isBaseCurrency,
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * Sets or updates currency rate (Admin only)
   */
  async upsertCurrency(input: {
    code: string;
    name: string;
    symbol: string;
    exchangeRateToBase: number;
    isBaseCurrency?: boolean;
  }) {
    const code = input.code.toUpperCase();
    if (input.exchangeRateToBase <= 0) {
      throw new BadRequestError('Exchange rate must be greater than 0');
    }

    const currency = await prisma.currency.upsert({
      where: { code },
      update: {
        name: input.name,
        symbol: input.symbol,
        exchangeRateToBase: input.exchangeRateToBase,
        isBaseCurrency: input.isBaseCurrency ?? false,
      },
      create: {
        code,
        name: input.name,
        symbol: input.symbol,
        exchangeRateToBase: input.exchangeRateToBase,
        isBaseCurrency: input.isBaseCurrency ?? false,
      },
    });

    logger.info(`Currency upserted [Code: ${currency.code}, Rate: ${currency.exchangeRateToBase}]`);

    return {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchangeRateToBase: Number(currency.exchangeRateToBase),
      isBaseCurrency: currency.isBaseCurrency,
      updatedAt: currency.updatedAt.toISOString(),
    };
  }

  /**
   * Utility for other members: Converts an amount between any two supported currencies
   */
  async convertAmount(amount: number, fromCurrencyCode: string, toCurrencyCode: string): Promise<number> {
    const from = fromCurrencyCode.toUpperCase();
    const to = toCurrencyCode.toUpperCase();

    if (from === to) return amount;

    const [fromCurr, toCurr] = await Promise.all([
      prisma.currency.findUnique({ where: { code: from } }),
      prisma.currency.findUnique({ where: { code: to } }),
    ]);

    if (!fromCurr) throw new NotFoundError(`Source currency '${from}' not supported`);
    if (!toCurr) throw new NotFoundError(`Target currency '${to}' not supported`);

    // Normalized to base currency first: baseAmount = amount / fromRate
    const baseAmount = amount / Number(fromCurr.exchangeRateToBase);
    // Converted to target currency: targetAmount = baseAmount * toRate
    const targetAmount = baseAmount * Number(toCurr.exchangeRateToBase);

    return Number(targetAmount.toFixed(4));
  }
}

export const currencyService = new CurrencyService();
