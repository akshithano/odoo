export interface CreateOrderParams {
  invoiceId: string;
  amount: number;
  currency: string;
  customer: {
    id: string;
    email: string;
    name: string;
    phone?: string;
  };
  notes?: Record<string, string>;
}

export interface GatewayOrder {
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  keyId?: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface RefundParams {
  paymentReference: string;
  amount: number;
  currency: string;
  reason?: string;
}

export interface GatewayRefund {
  refundId: string;
  provider: string;
  amount: number;
  status: string;
}

export interface WebhookResult {
  verified: boolean;
  event: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  rawPayload: unknown;
}

export interface IPaymentGatewayAdapter {
  readonly providerName: string;
  createOrder(params: CreateOrderParams): Promise<GatewayOrder>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
  processWebhook(headers: Record<string, string | string[] | undefined>, rawBody: unknown): Promise<WebhookResult>;
  refundPayment(params: RefundParams): Promise<GatewayRefund>;
}
