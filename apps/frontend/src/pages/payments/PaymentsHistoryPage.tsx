import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, CheckCircle, Clock, XCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { paymentsApi } from '../../api/payments';
import { PaymentDto, PaymentStatus } from '@odoo/shared';

export const PaymentsHistoryPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await paymentsApi.getPayments({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setPayments(data.items || []);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const getStatusBadge = (status: PaymentStatus | string) => {
    switch (status) {
      case PaymentStatus.SUCCESS:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Success
          </span>
        );
      case PaymentStatus.REFUNDED:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <RotateCcw className="w-3 h-3 mr-1" /> Refunded
          </span>
        );
      case PaymentStatus.PARTIALLY_REFUNDED:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <RotateCcw className="w-3 h-3 mr-1" /> Partially Refunded
          </span>
        );
      case PaymentStatus.FAILED:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </span>
        );
      case PaymentStatus.PENDING:
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <CreditCard className="w-7 h-7 mr-2 text-indigo-600" />
            Payment History & Settlement Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete transaction ledger across manual payments, online gateway checkouts, and refunds.
          </p>
        </div>

        <Link
          to="/payments/retries"
          className="inline-flex items-center px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
        >
          View Dunning Retries
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-2 overflow-x-auto">
        {['ALL', 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === st
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-600" />
            Loading payments...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">No Payments Recorded</h3>
            <p className="text-sm text-slate-500 mt-1">Recorded payments and online gateway transactions will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Invoice Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {p.paymentNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-600">
                      <Link to={`/invoices/${p.invoiceId}`} className="hover:underline">
                        {p.invoice?.invoiceNumber || p.invoiceId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{p.paymentMethod}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">
                      {p.transactionReference || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      ${Number(p.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
