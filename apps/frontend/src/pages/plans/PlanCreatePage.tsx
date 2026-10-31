import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { BillingFrequency } from '@odoo/shared';
import { CalendarRange, ArrowLeft, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';

export const PlanCreatePage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    billingFrequency: BillingFrequency.MONTHLY,
    basePrice: 99,
    currency: 'USD',
    minimumQuantity: 1,
    validFrom: '',
    validUntil: '',
    autoCloseOnExpiry: true,
    allowEarlyClosure: true,
    allowPause: true,
    allowRenewal: true,
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === 'basePrice' || name === 'minimumQuantity') {
      setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (formData.basePrice < 0) {
      setError('Base price cannot be negative');
      return;
    }

    if (formData.minimumQuantity < 1) {
      setError('Minimum quantity must be at least 1');
      return;
    }

    if (formData.validFrom && formData.validUntil) {
      const from = new Date(formData.validFrom);
      const until = new Date(formData.validUntil);
      if (until <= from) {
        setError('Validity End Date must be strictly after the Start Date');
        return;
      }
    }

    setIsLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
        billingFrequency: formData.billingFrequency,
        basePrice: formData.basePrice,
        currency: formData.currency.toUpperCase(),
        minimumQuantity: formData.minimumQuantity,
        validFrom: formData.validFrom ? new Date(formData.validFrom).toISOString() : undefined,
        validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : undefined,
        autoCloseOnExpiry: formData.autoCloseOnExpiry,
        allowEarlyClosure: formData.allowEarlyClosure,
        allowPause: formData.allowPause,
        allowRenewal: formData.allowRenewal,
      };

      const res = await apiClient.post('/plans', payload);
      if (res.data?.success) {
        setSuccess('Subscription plan created successfully!');
        setTimeout(() => {
          navigate(`/plans/${res.data.data.id}`);
        }, 1200);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; details?: Array<{ message: string }> };
      if (errorObj.details && errorObj.details.length > 0) {
        setError(errorObj.details.map((d) => d.message).join(', '));
      } else {
        setError(errorObj.message || 'Failed to create subscription plan');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/plans"
        className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Subscription Plans
      </Link>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create Subscription Plan</h1>
            <p className="text-xs text-slate-500">
              Configure billing cycle cadences, recurring base pricing, and lifecycle policies
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-700 text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{success}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Information */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Plan Identification & Cadence
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleFieldChange}
                  placeholder="e.g. Enterprise Monthly Cloud"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Code *</label>
                <input
                  type="text"
                  required
                  name="code"
                  value={formData.code}
                  onChange={handleFieldChange}
                  placeholder="e.g. PLAN-ENT-M"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Billing Frequency *
                </label>
                <select
                  name="billingFrequency"
                  value={formData.billingFrequency}
                  onChange={handleFieldChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={BillingFrequency.DAILY}>Daily</option>
                  <option value={BillingFrequency.WEEKLY}>Weekly</option>
                  <option value={BillingFrequency.MONTHLY}>Monthly</option>
                  <option value={BillingFrequency.YEARLY}>Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Base Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  name="basePrice"
                  value={formData.basePrice}
                  onChange={handleFieldChange}
                  placeholder="99.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Currency *</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleFieldChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Minimum Order Quantity (MOQ) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  name="minimumQuantity"
                  value={formData.minimumQuantity}
                  onChange={handleFieldChange}
                  placeholder="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Valid From</label>
                <input
                  type="datetime-local"
                  name="validFrom"
                  value={formData.validFrom}
                  onChange={handleFieldChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valid Until (Expiry)
                </label>
                <input
                  type="datetime-local"
                  name="validUntil"
                  value={formData.validUntil}
                  onChange={handleFieldChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  name="description"
                  value={formData.description}
                  onChange={handleFieldChange}
                  placeholder="Subscription plan contractual details and SLA..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Lifecycle & Policy Permissions */}
          <div className="pt-6 border-t border-slate-200">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-indigo-600" /> Lifecycle Operations & Policy
              Controls
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Configure whether early closure, pause, and renewal are permitted for this plan
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-start space-x-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  name="autoCloseOnExpiry"
                  checked={formData.autoCloseOnExpiry}
                  onChange={handleFieldChange}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-800">
                    Auto-Close on Expiry
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Automatically close plan when validity ends via scheduled sweep
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  name="allowEarlyClosure"
                  checked={formData.allowEarlyClosure}
                  onChange={handleFieldChange}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-800">
                    Permit Early Closure
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Allow administrators to close this plan before its validity expiry
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  name="allowPause"
                  checked={formData.allowPause}
                  onChange={handleFieldChange}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-800">Permit Pausing</span>
                  <span className="text-[11px] text-slate-500">
                    Allow the plan to be temporarily paused and resumed
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  name="allowRenewal"
                  checked={formData.allowRenewal}
                  onChange={handleFieldChange}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-800">Permit Renewal</span>
                  <span className="text-[11px] text-slate-500">
                    Allow extending plan validity timestamp for renewal contracts
                  </span>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-60 flex items-center justify-center"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              'Save & Activate Subscription Plan'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
