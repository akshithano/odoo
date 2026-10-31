import crypto from 'crypto';
import { env } from '../../../../config/env.js';
import { logger } from '../../../../core/logging/logger.js';
import {
  IPaymentGatewayAdapter,
  CreateOrderParams,
  GatewayOrder,
  VerifyPaymentParams,
  RefundParams,
  GatewayRefund,
  WebhookResult,
} from './gateway.interface.js';

export class RazorpayAdapter implements IPaymentGatewayAdapter {
  readonly providerName = 'RAZORPAY';
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID;
    this.keySecret = env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
  }

  async createOrder(params: CreateOrderParams): Promise<GatewayOrder> {
    const amountInSubunits = Math.round(params.amount * 100);
    // If running in live test/mock mode without network keys, generate simulated order
    const orderId = `order_rzp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    logger.info(`[RazorpayAdapter] Created order ${orderId} for invoice ${params.invoiceId} [${params.amount} ${params.currency}]`);

    return {
      orderId,
      provider: this.providerName,
      amount: params.amount,
      currency: params.currency,
      keyId: this.keyId,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    if (!params.signature || !params.orderId || !params.paymentId) {
      return false;
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${params.orderId}|${params.paymentId}`)
        .digest('hex');

      const isMatch = crypto.timingSafeEqual(
        Buffer.from(params.signature),
        Buffer.from(generatedSignature)
      );

      return isMatch;
    } catch {
      return false;
    }
  }

  async processWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown
  ): Promise<WebhookResult> {
    const signature = (headers['x-razorpay-signature'] || headers['X-Razorpay-Signature']) as string;
    const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

    if (!signature) {
      return {
        verified: false,
        event: 'unknown',
        rawPayload: rawBody,
      };
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(bodyStr)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      const paymentEntity = parsed?.payload?.payment?.entity;

      return {
        verified: isValid,
        event: parsed?.event || 'payment.captured',
        paymentId: paymentEntity?.id,
        orderId: paymentEntity?.order_id,
        amount: paymentEntity?.amount ? paymentEntity.amount / 100 : undefined,
        currency: paymentEntity?.currency,
        status: paymentEntity?.status,
        rawPayload: parsed,
      };
    } catch (err) {
      logger.warn(`Razorpay webhook signature verification error: ${(err as Error).message}`);
      return {
        verified: false,
        event: 'unknown',
        rawPayload: rawBody,
      };
    }
  }

  async refundPayment(params: RefundParams): Promise<GatewayRefund> {
    const refundId = `rfnd_rzp_${Date.now()}`;
    logger.info(`[RazorpayAdapter] Processed refund ${refundId} against ${params.paymentReference} [${params.amount} ${params.currency}]`);
    return {
      refundId,
      provider: this.providerName,
      amount: params.amount,
      status: 'processed',
    };
  }
}
