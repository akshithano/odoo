import crypto from 'crypto';
import {
  IPaymentGatewayAdapter,
  CreateOrderParams,
  GatewayOrder,
  VerifyPaymentParams,
  RefundParams,
  GatewayRefund,
  WebhookResult,
} from './gateway.interface.js';

export class MockGatewayAdapter implements IPaymentGatewayAdapter {
  readonly providerName = 'MOCK';

  async createOrder(params: CreateOrderParams): Promise<GatewayOrder> {
    const orderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return {
      orderId,
      provider: this.providerName,
      amount: params.amount,
      currency: params.currency,
      keyId: 'mock_key_test_id',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    if (!params.signature || params.signature === 'invalid_signature') {
      return false;
    }
    // Any signature starting with mock_sig or matching sha256 of order|payment is valid
    if (params.signature.startsWith('mock_sig_')) {
      return true;
    }
    const expected = crypto
      .createHmac('sha256', 'mock_secret')
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');
    return params.signature === expected || params.signature === 'valid_test_sig';
  }

  async processWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown
  ): Promise<WebhookResult> {
    const signature = headers['x-razorpay-signature'] || headers['x-mock-signature'];
    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody as Record<string, unknown>);

    // If signature equals 'invalid', fail verification
    if (signature === 'invalid_signature' || !signature) {
      return {
        verified: false,
        event: (payload?.event as string) || 'payment.captured',
        rawPayload: payload,
      };
    }

    const payloadObj = payload as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            currency?: string;
            status?: string;
          };
        };
      };
    };

    const paymentEntity = payloadObj?.payload?.payment?.entity;

    return {
      verified: true,
      event: payloadObj?.event || 'payment.captured',
      paymentId: paymentEntity?.id || 'pay_mock_' + Date.now(),
      orderId: paymentEntity?.order_id,
      amount: paymentEntity?.amount ? paymentEntity.amount / 100 : undefined,
      currency: paymentEntity?.currency || 'USD',
      status: paymentEntity?.status || 'captured',
      rawPayload: payload,
    };
  }

  async refundPayment(params: RefundParams): Promise<GatewayRefund> {
    return {
      refundId: `rfnd_mock_${Date.now()}`,
      provider: this.providerName,
      amount: params.amount,
      status: 'processed',
    };
  }
}
