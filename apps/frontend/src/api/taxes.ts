import { apiClient } from './client';
import { TaxRuleDto, CreateTaxRuleInput } from '@odoo/shared';

export const taxesApi = {
  getTaxRules: async (onlyActive = false) => {
    const res = await apiClient.get<{ success: boolean; data: TaxRuleDto[] }>('/tax-rules', {
      params: { active: onlyActive },
    });
    return res.data.data;
  },

  createTaxRule: async (input: CreateTaxRuleInput) => {
    const res = await apiClient.post<{ success: boolean; data: TaxRuleDto }>('/tax-rules', input);
    return res.data.data;
  },

  updateTaxRule: async (id: string, input: Partial<CreateTaxRuleInput>) => {
    const res = await apiClient.put<{ success: boolean; data: TaxRuleDto }>(`/tax-rules/${id}`, input);
    return res.data.data;
  },

  toggleActive: async (id: string) => {
    const res = await apiClient.patch<{ success: boolean; data: TaxRuleDto }>(`/tax-rules/${id}/toggle-active`);
    return res.data.data;
  },

  calculateTax: async (amount: number, taxRuleIds?: string[], country?: string) => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/tax-rules/calculate', {
      amount,
      taxRuleIds,
      country,
    });
    return res.data.data;
  },
};
