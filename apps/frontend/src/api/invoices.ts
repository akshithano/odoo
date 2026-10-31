import { apiClient } from './client';
import { InvoiceDto, GenerateCycleResult } from '@odoo/shared';

export const invoicesApi = {
  getInvoices: async (params: {
    status?: string;
    customerId?: string;
    subscriptionId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const res = await apiClient.get<{ success: boolean; items: InvoiceDto[]; pagination: any }>('/invoices', { params });
    return res.data;
  },

  getInvoiceById: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: InvoiceDto }>(`/invoices/${id}`);
    return res.data.data;
  },

  generateCycle: async (asOfDate?: string) => {
    const res = await apiClient.post<{ success: boolean; data: GenerateCycleResult }>('/invoices/generate-cycle', { asOfDate });
    return res.data.data;
  },

  confirmInvoice: async (id: string, discountCode?: string) => {
    const res = await apiClient.post<{ success: boolean; data: InvoiceDto }>(`/invoices/${id}/confirm`, { discountCode });
    return res.data.data;
  },

  cancelInvoice: async (id: string) => {
    const res = await apiClient.post<{ success: boolean; data: InvoiceDto }>(`/invoices/${id}/cancel`);
    return res.data.data;
  },

  updateDraftInvoice: async (id: string, data: any) => {
    const res = await apiClient.put<{ success: boolean; data: InvoiceDto }>(`/invoices/${id}`, data);
    return res.data.data;
  },

  markOverdueInvoices: async () => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/invoices/mark-overdue');
    return res.data.data;
  },

  getOverdueInvoices: async () => {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        totalOverdueCount: number;
        totalOutstandingAmount: number;
        invoices: any[];
      };
    }>('/invoices/overdue');
    return res.data.data;
  },

  getInvoicePdfUrl: (id: string) => {
    const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    return `${base}/invoices/${id}/pdf`;
  },
};
