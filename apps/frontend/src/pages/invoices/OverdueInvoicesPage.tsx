import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Eye,
  RotateCw,
  FileText,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import { paymentsApi } from '../../api/payments';

export const OverdueInvoicesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalOverdueCount: number;
    totalOutstandingAmount: number;
    invoices: any[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchOverdue = async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.getOverdueInvoices();
      setData(res);
    } catch (err: any) {
      setMessage(err.message || 'Failed to load overdue invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverdue();
  }, []);

  const handleManualRetry = async (invoiceId: string) => {
    try {
      await paymentsApi.triggerManualRetry(invoiceId);
      setMessage(`Manual retry scheduled successfully for invoice.`);
      fetchOverdue();
    } catch (err: any) {
      setMessage(err.message || 'Failed to trigger retry');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/invoices"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <AlertTriangle className="w-7 h-7 mr-2 text-rose-600" />
            Overdue Invoices & Dunning Escalations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track past-due invoices, overdue duration, outstanding exposure, and manage smart dunning retries.
          </p>
        </div>

        <button
          onClick={fetchOverdue}
          className="inline-flex items-center px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </button>
      </div>

      {message && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Overdue Accounts
            </span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {data?.totalOverdueCount || 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Outstanding Balance
            </span>
            <div className="text-2xl font-black text-rose-600 mt-0.5">
              ${(data?.totalOutstandingAmount || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading overdue queue...</div>
        ) : !data?.invoices || data.invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">Zero Overdue Invoices</h3>
            <p className="text-sm text-slate-500 mt-1">All customer accounts are in good standing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Subscription</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Days Overdue</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                      <Link to={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inv.customerName}</div>
                      <div className="text-xs text-slate-500">{inv.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {inv.subscriptionNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        {inv.overdueDays} days past due
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">
                      ${inv.outstandingBalance.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                          title="View Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleManualRetry(inv.id)}
                          className="inline-flex items-center px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded text-xs font-medium"
                          title="Trigger Dunning Payment Retry"
                        >
                          <RotateCw className="w-3 h-3 mr-1" /> Retry
                        </button>
                      </div>
                    </td>
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
