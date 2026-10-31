import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { invoicesApi } from '../../api/invoices';
import { InvoiceDto, InvoiceStatus, UserRole } from '@odoo/shared';
import { useAuth } from '../../context/AuthContext';

export const InvoicesListPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === UserRole.ADMIN || user?.role === UserRole.STAFF;

  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await invoicesApi.getInvoices({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchTerm || undefined,
      });
      setInvoices(data.items || []);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to fetch invoices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const handleGenerateCycle = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await invoicesApi.generateCycle();
      setMessage({
        text: `Billing run complete! Created ${res.invoicesCreated} invoices, skipped ${res.invoicesSkippedAlreadyBilled} already billed.`,
        type: 'success',
      });
      fetchInvoices();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to run billing cycle', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkOverdue = async () => {
    try {
      const res = await invoicesApi.markOverdueInvoices();
      setMessage({
        text: `Overdue check complete: ${res.markedOverdue} invoices updated to OVERDUE.`,
        type: 'success',
      });
      fetchInvoices();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to run overdue evaluation', type: 'error' });
    }
  };

  const getStatusBadge = (status: InvoiceStatus | string) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Paid
          </span>
        );
      case InvoiceStatus.PARTIALLY_PAID:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3 mr-1" /> Partially Paid
          </span>
        );
      case InvoiceStatus.CONFIRMED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Confirmed
          </span>
        );
      case InvoiceStatus.OVERDUE:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 mr-1" /> Overdue
          </span>
        );
      case InvoiceStatus.CANCELLED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3 h-3 mr-1" /> Cancelled
          </span>
        );
      case InvoiceStatus.DRAFT:
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1" /> Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <FileText className="w-7 h-7 mr-2 text-indigo-600" />
            Invoices & Billing Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage recurring subscription invoices, billing cycles, customer balances, and tax ledgers.
          </p>
        </div>

        {isAdminOrStaff && (
          <div className="flex items-center space-x-3">
            <Link
              to="/invoices/overdue"
              className="inline-flex items-center px-3 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors"
            >
              <AlertTriangle className="w-4 h-4 mr-1.5" /> Overdue Queue
            </Link>
            <button
              onClick={handleMarkOverdue}
              className="inline-flex items-center px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
              title="Evaluate past-due invoices"
            >
              Scan Overdue
            </button>
            <button
              onClick={handleGenerateCycle}
              disabled={generating}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              Run Billing Cycle
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-sm font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {['ALL', 'DRAFT', 'CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 w-full md:w-72">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search invoice #, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button
            onClick={fetchInvoices}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-600" />
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800 mb-1">No invoices found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
              There are no invoices matching your current filter. Run a billing cycle or check back after the next scheduled run.
            </p>
            {isAdminOrStaff && (
              <button
                onClick={handleGenerateCycle}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" /> Trigger Billing Cycle
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const remaining = Math.max(0, Number(inv.totalAmount) - Number(inv.amountPaid));
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                        <Link to={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {inv.customer?.user ? `${inv.customer.user.firstName} ${inv.customer.user.lastName}` : (inv.customerSnapshot as any)?.name || 'Customer'}
                        </div>
                        <div className="text-xs text-slate-500">{inv.customer?.user?.email || (inv.customerSnapshot as any)?.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(inv.issueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(inv.status)}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">
                        ${Number(inv.totalAmount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                        ${Number(inv.amountPaid).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">
                        ${remaining.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Link
                            to={`/invoices/${inv.id}`}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="View Invoice Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <a
                            href={invoicesApi.getInvoicePdfUrl(inv.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                            title="Print / PDF View"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
