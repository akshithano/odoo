import { ProductType, PlanStatus } from '../enums/catalog.js';
import { BillingFrequency } from '../enums/subscriptions.js';
import { UserRole } from '../enums/roles.js';

export interface UserSummaryDTO {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  customerId?: string | null;
  createdAt: string;
}

export interface CustomerDTO {
  id: string;
  userId: string;
  companyName?: string | null;
  phone?: string | null;
  billingAddressLine1: string;
  billingCity: string;
  billingState?: string | null;
  billingPostalCode: string;
  billingCountry: string;
  defaultCurrency: string;
  createdAt: string;
}

export interface ProductVariantDTO {
  id: string;
  productId: string;
  variantName: string;
  sku: string;
  attributeName?: string | null;
  attributeValue?: string | null;
  additionalPrice: number;
  calculatedPrice?: number;
  isActive: boolean;
  createdAt: string;
}

export interface ProductDTO {
  id: string;
  name: string;
  code: string;
  type: ProductType;
  description?: string | null;
  internalNotes?: string | null;
  salesPrice: number;
  costPrice: number;
  isActive: boolean;
  variants: ProductVariantDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanDTO {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  billingFrequency: BillingFrequency;
  basePrice: number;
  currency: string;
  minimumQuantity: number;
  validFrom?: string | null;
  validUntil?: string | null;
  autoCloseOnExpiry: boolean;
  allowEarlyClosure: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  status: PlanStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyDTO {
  code: string;
  name: string;
  symbol: string;
  exchangeRateToBase: number;
  isBaseCurrency: boolean;
  updatedAt: string;
}
