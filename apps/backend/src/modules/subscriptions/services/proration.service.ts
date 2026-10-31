import { BadRequestError } from '../../../core/errors/appError.js';

export interface ProrationInput {
  periodStart: Date;
  periodEnd: Date;
  effectiveDate: Date;
  oldPlanPrice: number;
  newPlanPrice: number;
}

export interface ProrationResult {
  totalDaysInCycle: number;
  daysRemaining: number;
  oldPlanPrice: number;
  newPlanPrice: number;
  proratedCredit: number; // Credit for unconsumed days of old plan
  proratedDebit: number;  // Debit for remaining days of new plan
  netAdjustmentDue: number; // positive = customer owes; negative = credit balance
  effectiveDate: string;
}

export class ProrationService {
  /**
   * Calculates mid-cycle subscription upgrade proration
   */
  calculateProration(input: ProrationInput): ProrationResult {
    const { periodStart, periodEnd, effectiveDate, oldPlanPrice, newPlanPrice } = input;

    if (periodEnd.getTime() <= periodStart.getTime()) {
      throw new BadRequestError('Billing period end date must be after period start date');
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Total days in billing cycle
    const totalDaysInCycle = Math.max(
      1,
      Math.round((periodEnd.getTime() - periodStart.getTime()) / ONE_DAY_MS)
    );

    // Days remaining from effective date until cycle end
    const rawDaysRemaining = Math.round((periodEnd.getTime() - effectiveDate.getTime()) / ONE_DAY_MS);
    const daysRemaining = Math.max(0, Math.min(totalDaysInCycle, rawDaysRemaining));

    // Ratio of cycle remaining
    const ratio = daysRemaining / totalDaysInCycle;

    // Credit = unconsumed portion of old plan
    const proratedCredit = Number((oldPlanPrice * ratio).toFixed(4));

    // Debit = prorated charge for new plan for remaining period
    const proratedDebit = Number((newPlanPrice * ratio).toFixed(4));

    // Net adjustment = Debit - Credit
    const netAdjustmentDue = Number((proratedDebit - proratedCredit).toFixed(4));

    return {
      totalDaysInCycle,
      daysRemaining,
      oldPlanPrice: Number(oldPlanPrice.toFixed(4)),
      newPlanPrice: Number(newPlanPrice.toFixed(4)),
      proratedCredit,
      proratedDebit,
      netAdjustmentDue,
      effectiveDate: effectiveDate.toISOString(),
    };
  }
}

export const prorationService = new ProrationService();
