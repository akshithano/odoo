import { apiClient } from './client';
import { DiscountDto, CreateDiscountInput, ValidateDiscountInput } from '@odoo/shared';

export const discountsApi = {
  getDiscounts: async (onlyActive = false) => {
    const res = await apiClient.get<{ success: boolean; data: DiscountDto[] }>('/discounts', {
      params: { active: onlyActive },
    });
    return res.data.data;
  },

  getDiscountById: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: DiscountDto }>(`/discounts/${id}`);
    return res.data.data;
  },

  createDiscount: async (input: CreateDiscountInput) => {
    const res = await apiClient.post<{ success: boolean; data: DiscountDto }>('/discounts', input);
    return res.data.data;
  },

  updateDiscount: async (id: string, input: Partial<CreateDiscountInput>) => {
    const res = await apiClient.put<{ success: boolean; data: DiscountDto }>(`/discounts/${id}`, input);
    return res.data.data;
  },

  toggleActive: async (id: string) => {
    const res = await apiClient.patch<{ success: boolean; data: DiscountDto }>(`/discounts/${id}/toggle-active`);
    return res.data.data;
  },

  validateDiscount: async (input: ValidateDiscountInput) => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/discounts/validate', input);
    return res.data.data;
  },
};
