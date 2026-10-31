import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@odoo/shared';
import { currencyService } from '../services/currency.service.js';

export class CurrencyController {
  async listCurrencies(req: Request, res: Response, next: NextFunction) {
    try {
      const currencies = await currencyService.listCurrencies();
      const response: ApiResponse<typeof currencies> = {
        success: true,
        data: currencies,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async upsertCurrency(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, name, symbol, exchangeRateToBase, isBaseCurrency } = req.body;
      const currency = await currencyService.upsertCurrency({
        code,
        name,
        symbol,
        exchangeRateToBase: Number(exchangeRateToBase),
        isBaseCurrency: Boolean(isBaseCurrency),
      });
      const response: ApiResponse<typeof currency> = {
        success: true,
        message: 'Currency updated successfully',
        data: currency,
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async convertAmount(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, from, to } = req.body;
      const converted = await currencyService.convertAmount(Number(amount), String(from), String(to));
      const response: ApiResponse<{ originalAmount: number; from: string; convertedAmount: number; to: string }> = {
        success: true,
        data: {
          originalAmount: Number(amount),
          from: String(from).toUpperCase(),
          convertedAmount: converted,
          to: String(to).toUpperCase(),
        },
      };
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const currencyController = new CurrencyController();
