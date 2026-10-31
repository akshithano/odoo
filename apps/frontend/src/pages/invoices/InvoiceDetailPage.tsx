import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  CreditCard,
  DollarSign,
  Printer,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Shield,
  Tag,
  XCircle,
} from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import { paymentsApi } from '../../api/payments';
import { InvoiceDto, InvoiceStatus, UserRole } from '@odoo/shared';
import { useAuth } from '../../context/AuthContext';
import { PaymentCheckoutModal } from '../../components/billing/PaymentCheckoutModal';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === UserRole.ADMIN || user?.role === UserRole.STAFF;

  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isManualPayOpen, setIsManualPayOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Manual payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_WIRE');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Confirm form
  const [discountCode, setDiscountCode] = useState('');

  // Refund form
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const fetchInvoice = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await invoicesApi.getInvoiceById(id);
      setInvoice(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleConfirm = async () => {
    if (!invoice) return;
    setError(null);
    try {
      await invoicesApi.confirmInvoice(invoice.id, discountCode || undefined);
      setSuccessMsg('Invoice confirmed and snapshot locked successfully!');
      setIsConfirmOpen(false);
      fetchInvoice();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm invoice');
    }
  };

  const handleCancel = async () => {
    if (!invoice || !window.confirm('Are you sure you want to cancel this invoice?')) return;
    try {
      await invoicesApi.cancelInvoice(invoice.id);
      setSuccessMsg('Invoice cancelled');
      fetchInvoice();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invoice');
    }
  };

  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setError(null);
    try {
      await paymentsApi.recordPayment({
        invoiceId: invoice.id,
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        transactionReference: payRef || undefined,
        notes: payNotes || undefined,
      });
      setSuccessMsg('Manual payment recorded successfully!');
      setIsManualPayOpen(false);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      fetchInvoice();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await paymentsApi.processRefund({
        paymentId: selectedPaymentId,
        amount: parseFloat(refundAmount),
        reason: refundReason,
      });
      setSuccessMsg('Refund processed and balance updated successfully!');
      setIsRefundOpen(false);
      setRefundAmount('');
      setRefundReason('');
      fetchInvoice();
    } catch (err: any) {
      setError(err.message || 'Failed to process refund');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <FileText className="w-10 h-10 mx-auto mb-3 animate-pulse text-indigo-600" />
        Loading invoice...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-16 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice Not Found</h2>
        <Link to="/invoices" className="text-indigo-600 hover:underline text-sm font-medium">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  const remainingBalance = Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid));
  const isPaid = invoice.status === InvoiceStatus.PAID;
  const isDraft = invoice.status === InvoiceStatus.DRAFT;
  const isCancelled = invoice.status === InvoiceStatus.CANCELLED;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/invoices')}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Invoices
        </button>

        <div className="flex items-center space-x-3">
          <a
            href={invoicesApi.getInvoicePdfUrl(invoice.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
          </a>

          {!isPaid && !isCancelled && (
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <CreditCard className="w-4 h-4 mr-1.5" /> Pay Online
            </button>
          )}

          {isAdminOrStaff && !isPaid && !isCancelled && (
            <button
              onClick={() => {
                setPayAmount(remainingBalance.toString());
                setIsManualPayOpen(true);
              }}
              className="inline-flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <DollarSign className="w-4 h-4 mr-1" /> Record Payment
            </button>
          )}

          {isAdminOrStaff && isDraft && (
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" /> Confirm Invoice
            </button>
          )}

          {isAdminOrStaff && !isPaid && !isCancelled && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-3 py-2 border border-slate-300 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors"
            >
              <XCircle className="w-4 h-4 mr-1" /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Invoice Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Banner */}
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-2xl font-extrabold text-slate-900 tracking-tight">
                {invoice.invoiceNumber}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                {invoice.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Subscription:{' '}
              <Link
                to={`/subscriptions/${invoice.subscriptionId}`}
                className="font-mono text-indigo-600 hover:underline"
              >
                {invoice.subscription?.subscriptionNumber || invoice.subscriptionId.slice(0, 8)}
              </Link>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Issue Date</span>
              <p className="font-medium text-slate-800 mt-0.5">
                {new Date(invoice.issueDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Due Date</span>
              <p className="font-medium text-slate-800 mt-0.5">
                {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Customer Snapshot */}
        <div className="p-6 border-b border-slate-100 grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center">
              <Shield className="w-3.5 h-3.5 mr-1 text-slate-400" /> Billed To (Immutable Snapshot)
            </h4>
            <div className="text-sm text-slate-700 space-y-0.5">
              <p className="font-semibold text-slate-900">{(invoice.customerSnapshot as any)?.name}</p>
              {(invoice.customerSnapshot as any)?.companyName && (
                <p className="text-slate-600">{(invoice.customerSnapshot as any).companyName}</p>
              )}
              <p>{(invoice.customerSnapshot as any)?.email}</p>
              <p>{(invoice.customerSnapshot as any)?.billingAddressLine1}</p>
              <p>
                {(invoice.customerSnapshot as any)?.billingCity}, {(invoice.customerSnapshot as any)?.billingCountry}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Billing Period
            </h4>
            <div className="text-sm text-slate-600 space-y-1">
              <p>
                <strong className="text-slate-800">From:</strong> {new Date(invoice.billingPeriodStart).toLocaleDateString()}
              </p>
              <p>
                <strong className="text-slate-800">To:</strong> {new Date(invoice.billingPeriodEnd).toLocaleDateString()}
              </p>
              <p>
                <strong className="text-slate-800">Currency:</strong> {invoice.currency}
              </p>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="p-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            Invoice Line Items
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Tax Rate</th>
                  <th className="py-2.5 px-3 text-right">Tax Amount</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines?.map((line) => (
                  <tr key={line.id}>
                    <td className="py-3 px-3 font-medium text-slate-900">{line.description}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{Number(line.quantity)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      ${Number(line.unitPrice).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {Number(line.taxRate).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      ${Number(line.taxAmount).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">
                      ${Number(line.lineTotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-full md:w-80 space-y-2 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discountAmount) > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span className="flex items-center">
                    <Tag className="w-3.5 h-3.5 mr-1" /> Discount:
                  </span>
                  <span>-${Number(invoice.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Taxes:</span>
                <span>${Number(invoice.taxAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount:</span>
                <span>${Number(invoice.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Paid Amount:</span>
                <span>${Number(invoice.amountPaid).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-extrabold text-base pt-1 border-t border-slate-200">
                <span>Remaining Balance:</span>
                <span>${remainingBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payments History Ledger */}
        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center">
              <CreditCard className="w-4 h-4 mr-1.5 text-indigo-600" /> Payment & Settlement History
            </h4>
          </div>

          {invoice.payments && invoice.payments.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3">Payment #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    {isAdminOrStaff && <th className="py-2.5 px-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-mono font-medium text-indigo-600">
                        {p.paymentNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{p.paymentMethod}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                        {p.transactionReference || 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                          {p.status}
                        </span>
                      </td>
                      {isAdminOrStaff && (
                        <td className="py-2.5 px-3 text-center">
                          {p.status === 'SUCCESS' && (
                            <button
                              onClick={() => {
                                setSelectedPaymentId(p.id);
                                setRefundAmount(Number(p.amount).toString());
                                setIsRefundOpen(true);
                              }}
                              className="inline-flex items-center text-xs text-rose-600 hover:text-rose-800 font-medium"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" /> Refund
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No payments recorded yet.</p>
          )}
        </div>
      </div>

      {/* Online Checkout Modal */}
      <PaymentCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={() => {
          setSuccessMsg('Payment successfully verified!');
          fetchInvoice();
        }}
        invoice={{
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
          amountPaid: Number(invoice.amountPaid),
          currency: invoice.currency,
        }}
      />

      {/* Confirm Invoice Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Confirm & Lock Invoice</h3>
            <p className="text-sm text-slate-500">
              Confirming freezes the customer address snapshot, applies taxes and discounts, and marks the invoice ready for collection.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Discount Coupon Code (Optional)
              </label>
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                placeholder="e.g. PROMO2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold"
              >
                Confirm Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Recording Modal */}
      {isManualPayOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordManualPayment}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900">Record Offline Payment</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="BANK_WIRE">Bank Wire</option>
                <option value="CREDIT_CARD">Credit Card (Terminal)</option>
                <option value="CASH">Cash</option>
                <option value="CHECK">Check</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Transaction Reference
              </label>
              <input
                type="text"
                placeholder="Bank receipt, wire ref, or check #"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
              <textarea
                rows={2}
                placeholder="Internal audit notes"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsManualPayOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
              >
                Save Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Refund Modal */}
      {isRefundOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRefund}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900 flex items-center text-rose-600">
              <RotateCcw className="w-5 h-5 mr-1.5" /> Issue Refund
            </h3>
            <p className="text-sm text-slate-500">
              Issuing a refund will adjust the recorded payment status and recalculate the invoice balance.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Refund Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
              <input
                type="text"
                required
                placeholder="e.g. Service cancellation or overcharge correction"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRefundOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold"
              >
                Execute Refund
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
