import { apiClient } from './client';
import { PaymentDto, RecordPaymentInput, CreateRefundInput, RefundDto, PaymentRetryDto } from '@odoo/shared';

export const paymentsApi = {
  getPayments: async (params: { customerId?: string; invoiceId?: string; status?: string; page?: number; limit?: number } = {}) => {
    const res = await apiClient.get<{ success: boolean; items: PaymentDto[]; pagination: any }>('/payments', { params });
    return res.data;
  },

  getPaymentById: async (id: string) => {
    const res = await apiClient.get<{ success: boolean; data: PaymentDto }>(`/payments/${id}`);
    return res.data.data;
  },

  recordPayment: async (input: RecordPaymentInput) => {
    const res = await apiClient.post<{ success: boolean; data: PaymentDto }>('/payments', input);
    return res.data.data;
  },

  createOnlineOrder: async (invoiceId: string) => {
    const res = await apiClient.post<{ success: boolean; data: any }>('/payments/create-order', { invoiceId });
    return res.data.data;
  },

  verifyPayment: async (input: { invoiceId: string; orderId: string; paymentId: string; signature: string }) => {
    const res = await apiClient.post<{ success: boolean; data: PaymentDto }>('/payments/verify', input);
    return res.data.data;
  },

  getRetries: async (invoiceId?: string) => {
    const res = await apiClient.get<{ success: boolean; data: PaymentRetryDto[] }>('/payments/retries', {
      params: { invoiceId },
    });
    return res.data.data;
  },

  triggerManualRetry: async (invoiceId: string) => {
    const res = await apiClient.post<{ success: boolean; data: any }>(`/payments/retries/${invoiceId}/manual`);
    return res.data.data;
  },

  processRefund: async (input: CreateRefundInput) => {
    const res = await apiClient.post<{ success: boolean; data: RefundDto }>('/refunds', input);
    return res.data.data;
  },

  getRefunds: async (params: { invoiceId?: string; paymentId?: string } = {}) => {
    const res = await apiClient.get<{ success: boolean; data: RefundDto[] }>('/refunds', { params });
    return res.data.data;
  },
};
