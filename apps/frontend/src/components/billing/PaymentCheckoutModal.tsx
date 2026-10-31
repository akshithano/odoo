import React, { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, X, Shield, Lock } from 'lucide-react';
import { paymentsApi } from '../../api/payments';

interface PaymentCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    amountPaid: number;
    currency: string;
  };
}

export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  invoice,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [simulatedCardNumber, setSimulatedCardNumber] = useState('4242 •••• •••• 4242');

  if (!isOpen) return null;

  const remainingBalance = Math.max(0, invoice.totalAmount - invoice.amountPaid);

  const handlePay = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create order on backend
      const order = await paymentsApi.createOnlineOrder(invoice.id);

      // 2. Simulate or handle gateway signature checkout
      const mockPaymentId = `pay_mock_${Date.now()}`;
      const mockSignature = `mock_sig_${Date.now()}`;

      // 3. Backend signature verification
      await paymentsApi.verifyPayment({
        invoiceId: invoice.id,
        orderId: order.orderId,
        paymentId: mockPaymentId,
        signature: mockSignature,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Payment processing failed. Please check credentials or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-indigo-200" />
            <h3 className="font-bold text-lg">Secure Online Checkout</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Invoice Summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between text-sm text-slate-500 mb-1">
              <span>Invoice Ref:</span>
              <span className="font-mono font-medium text-slate-800">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
              <span className="font-semibold text-slate-700">Amount Due:</span>
              <span className="text-2xl font-extrabold text-indigo-600">
                ${remainingBalance.toFixed(2)} <span className="text-xs text-slate-500 font-normal">{invoice.currency}</span>
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg flex items-center text-sm">
              <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 mr-2 shrink-0 text-emerald-600" />
              <span>Payment verified and recorded successfully!</span>
            </div>
          )}

          {!success && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Simulated Card / Gateway Method
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={simulatedCardNumber}
                    onChange={(e) => setSimulatedCardNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm bg-slate-50"
                  />
                  <CreditCard className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Razorpay / Mock Adapter integrated with HMAC signature verification.
                </p>
              </div>

              <div className="flex items-center text-xs text-slate-500 space-x-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>256-bit End-to-End Encrypted & Backend Verified</span>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={loading}
                  className="w-2/3 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    `Pay $${remainingBalance.toFixed(2)}`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
