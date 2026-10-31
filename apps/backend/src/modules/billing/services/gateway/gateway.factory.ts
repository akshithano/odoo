import { env } from '../../../../config/env.js';
import { IPaymentGatewayAdapter } from './gateway.interface.js';
import { MockGatewayAdapter } from './mock.adapter.js';
import { RazorpayAdapter } from './razorpay.adapter.js';

export class PaymentGatewayFactory {
  private static instance: IPaymentGatewayAdapter | null = null;

  static getAdapter(): IPaymentGatewayAdapter {
    if (!this.instance) {
      const provider = (env.PAYMENT_GATEWAY_PROVIDER || 'mock').toLowerCase();
      if (provider === 'razorpay') {
        this.instance = new RazorpayAdapter();
      } else {
        this.instance = new MockGatewayAdapter();
      }
    }
    return this.instance;
  }

  // Allow resetting/overriding adapter during unit and integration tests
  static setAdapter(adapter: IPaymentGatewayAdapter): void {
    this.instance = adapter;
  }

  static resetAdapter(): void {
    this.instance = null;
  }
}
