import { InvoiceStatus } from '../enums/invoices.js';
import { PaymentStatus, PaymentMethod, DiscountType, RetryStatus } from '../enums/payments.js';

export interface TaxRuleDto {
  id: string;
  name: string;
  ratePercentage: number;
  country?: string | null;
  state?: string | null;
  isCompound: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxRuleInput {
  name: string;
  ratePercentage: number;
  country?: string | null;
  state?: string | null;
  isCompound?: boolean;
  isActive?: boolean;
}

export interface DiscountDto {
  id: string;
  code: string;
  type: DiscountType | string;
  value: number;
  minPurchaseAmount: number;
  minQuantity: number;
  maxRedemptions: number;
  currentRedemptions: number;
  maxPerCustomer: number;
  startDate: string;
  endDate: string;
  productId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscountInput {
  code: string;
  type: DiscountType | string;
  value: number;
  minPurchaseAmount?: number;
  minQuantity?: number;
  maxRedemptions: number;
  maxPerCustomer?: number;
  startDate: string;
  endDate: string;
  productId?: string | null;
  isActive?: boolean;
}

export interface ValidateDiscountInput {
  code: string;
  customerId: string;
  purchaseAmount: number;
  quantity?: number;
  productId?: string;
}

export interface InvoiceLineDto {
  id: string;
  invoiceId: string;
  productId?: string | null;
  product?: {
    id: string;
    name: string;
    code: string;
  } | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  lineTotal: number;
}

export interface CustomerSnapshot {
  name: string;
  email: string;
  companyName?: string | null;
  phone?: string | null;
  billingAddressLine1: string;
  billingCity: string;
  billingState?: string | null;
  billingPostalCode: string;
  billingCountry: string;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  subscriptionId: string;
  customerId: string;
  status: InvoiceStatus;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  customerSnapshot: CustomerSnapshot;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: InvoiceLineDto[];
  payments?: PaymentDto[];
  retries?: PaymentRetryDto[];
  refunds?: RefundDto[];
  subscription?: {
    subscriptionNumber: string;
    plan?: {
      name: string;
      code: string;
    };
  };
  customer?: {
    id: string;
    companyName?: string | null;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export interface PaymentDto {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod | string;
  paymentDate: string;
  transactionReference?: string | null;
  gatewayOrderId?: string | null;
  status: PaymentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  refunds?: RefundDto[];
  invoice?: {
    invoiceNumber: string;
    totalAmount: number;
    amountPaid: number;
  };
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod | string;
  paymentDate?: string;
  transactionReference?: string;
  notes?: string;
}

export interface PaymentRetryDto {
  id: string;
  invoiceId: string;
  attemptNumber: number;
  attemptDate: string;
  nextRetryDate?: string | null;
  status: RetryStatus | string;
  errorMessage?: string | null;
}

export interface RefundDto {
  id: string;
  refundNumber: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  reason: string;
  transactionReference?: string | null;
  status: string;
  createdAt: string;
}

export interface CreateRefundInput {
  paymentId: string;
  amount: number;
  reason: string;
  transactionReference?: string;
}

export interface GenerateCycleResult {
  subscriptionsEvaluated: number;
  invoicesCreated: number;
  invoicesSkippedAlreadyBilled: number;
  totalBilledAmount: number;
  invoiceIds: string[];
}
