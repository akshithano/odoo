import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, ArrowLeft, Clock } from 'lucide-react';
import { paymentsApi } from '../../api/payments';
import { PaymentRetryDto } from '@odoo/shared';

export const PaymentRetryPage: React.FC = () => {
  const [retries, setRetries] = useState<PaymentRetryDto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRetries = async () => {
    setLoading(true);
    try {
      const data = await paymentsApi.getRetries();
      setRetries(data || []);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRetries();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <Link
          to="/payments"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Payments
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <RotateCw className="w-7 h-7 mr-2 text-indigo-600" />
          Smart Dunning & Payment Retries Log
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor automated recurring card payment retry intervals, backoff schedules, and failure telemetry.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading retry records...</div>
        ) : retries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">No Failed Payment Retries</h3>
            <p className="text-sm text-slate-500 mt-1">All invoices are settled or pending initial collection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Attempt #</th>
                  <th className="py-3 px-4">Attempt Date</th>
                  <th className="py-3 px-4">Next Scheduled</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Error Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {retries.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                      <Link to={`/invoices/${r.invoiceId}`} className="hover:underline">
                        {(r as any).invoice?.invoiceNumber || r.invoiceId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      Attempt {r.attemptNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(r.attemptDate).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.nextRetryDate ? new Date(r.nextRetryDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          r.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'ABANDONED'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {r.errorMessage || 'None'}
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
