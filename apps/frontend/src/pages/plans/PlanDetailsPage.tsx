import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { BillingFrequency, PlanStatus, UserRole } from '@odoo/shared';
import {
  CalendarRange,
  Clock,
  Calendar,
  Layers,
  ArrowLeft,
  Edit,
  Play,
  Pause,
  XOctagon,
  RefreshCw,
  CheckCircle,
  XCircle,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface PlanDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  billingFrequency: BillingFrequency;
  basePrice: number;
  currency: string;
  minimumQuantity: number;
  validFrom: string | null;
  validUntil: string | null;
  autoCloseOnExpiry: boolean;
  allowEarlyClosure: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  status: PlanStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PlanDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Lifecycle confirmation modal state
  const [actionType, setActionType] = useState<'pause' | 'resume' | 'close' | 'toggleActive' | null>(
    null
  );
  const [isExecuting, setIsExecuting] = useState(false);

  // Renewal Modal state
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [renewalDate, setRenewalDate] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const navigate = useNavigate();

  const fetchPlan = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/plans/${id}`);
      if (res.data?.success && res.data?.data) {
        setPlan(res.data.data);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load plan details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [id]);

  const handleConfirmLifecycleAction = async () => {
    if (!plan || !actionType) return;
    setIsExecuting(true);
    setFeedback(null);

    try {
      let endpoint = '';
      let payload: Record<string, unknown> | undefined = undefined;

      if (actionType === 'pause') endpoint = `/plans/${plan.id}/pause`;
      else if (actionType === 'resume') endpoint = `/plans/${plan.id}/resume`;
      else if (actionType === 'close') endpoint = `/plans/${plan.id}/close`;
      else if (actionType === 'toggleActive') {
        endpoint = `/plans/${plan.id}/status`;
        payload = { isActive: !plan.isActive };
      }

      const res = payload
        ? await apiClient.patch(endpoint, payload)
        : await apiClient.post(endpoint);

      if (res.data?.success && res.data?.data) {
        setPlan(res.data.data);
        setFeedback({
          type: 'success',
          message: `Plan lifecycle updated: Status is now ${res.data.data.status}`,
        });
        setActionType(null);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setFeedback({ type: 'error', message: errorObj.message || 'Operation failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !renewalDate) return;
    setIsRenewing(true);
    setFeedback(null);

    try {
      const res = await apiClient.post(`/plans/${plan.id}/renew`, {
        newValidUntil: new Date(renewalDate).toISOString(),
      });
      if (res.data?.success && res.data?.data) {
        setPlan(res.data.data);
        setIsRenewalModalOpen(false);
        setRenewalDate('');
        setFeedback({
          type: 'success',
          message: `Plan successfully renewed! New validity date: ${new Date(
            res.data.data.validUntil
          ).toLocaleString()}`,
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setFeedback({ type: 'error', message: errorObj.message || 'Renewal failed' });
    } finally {
      setIsRenewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-500">Loading plan specifications...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-6 rounded-xl border border-rose-200 text-center">
        <h2 className="text-lg font-bold text-rose-700 mb-2">Error Loading Plan</h2>
        <p className="text-sm text-slate-600 mb-6">{error || 'Plan not found'}</p>
        <button
          onClick={() => navigate('/plans')}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900"
        >
          Back to Plans List
        </button>
      </div>
    );
  }

  const statusBadge = (s: PlanStatus) => {
    switch (s) {
      case PlanStatus.ACTIVE:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case PlanStatus.PAUSED:
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case PlanStatus.CLOSED:
        return 'bg-slate-200 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/plans"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Plans
        </Link>

        {isAdmin && (
          <div className="flex items-center space-x-2">
            <Link
              to={`/plans/${plan.id}/edit`}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5 mr-1" /> Edit Plan
            </Link>

            <button
              onClick={() => setActionType('toggleActive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                plan.isActive
                  ? 'text-rose-700 border-rose-300 hover:bg-rose-50'
                  : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {plan.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start space-x-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
          )}
          <div>{feedback.message}</div>
        </div>
      )}

      {/* Main Plan Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-8 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-2xl">
              <CalendarRange className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 bg-white/10 text-indigo-200 rounded-md">
                  {plan.code}
                </span>
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  <Clock className="w-3 h-3 mr-1" />
                  {plan.billingFrequency}
                </span>
                <span
                  className={`inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusBadge(
                    plan.status
                  )}`}
                >
                  {plan.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold mt-1.5">{plan.name}</h1>
              <p className="text-indigo-200 text-xs mt-1">
                {plan.description || 'No description provided.'}
              </p>
            </div>
          </div>

          <div className="text-right bg-white/5 p-4 rounded-xl border border-white/10">
            <span className="text-xs text-indigo-300 block">Recurring Base Price</span>
            <span className="text-3xl font-extrabold font-mono text-emerald-400">
              ${plan.basePrice.toFixed(2)}
            </span>
            <span className="text-[11px] text-indigo-300 block">
              {plan.currency} / {plan.billingFrequency.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Plan Terms Grid */}
        <div className="p-6 sm:p-8 space-y-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
              <Calendar className="w-4 h-4 mr-1.5 text-indigo-600" /> Plan Availability & Quantity
              Constraints
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block">Minimum Order Qty (MOQ)</span>
                <span className="text-base font-bold text-slate-800">{plan.minimumQuantity} units</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block">Valid From Date</span>
                <span className="text-slate-800 font-medium">
                  {plan.validFrom ? new Date(plan.validFrom).toLocaleString() : 'Immediate / Open'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block">Valid Until (Expiry)</span>
                <span className="text-slate-800 font-medium">
                  {plan.validUntil ? (
                    new Date(plan.validUntil).toLocaleString()
                  ) : (
                    <span className="text-emerald-700 font-semibold">Indefinite (No expiry)</span>
                  )}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 block">Catalog Visibility</span>
                <span className="font-semibold text-slate-800">
                  {plan.isActive ? (
                    <span className="text-emerald-600 inline-flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Active
                    </span>
                  ) : (
                    <span className="text-rose-600 inline-flex items-center">
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Archived
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Lifecycle Permission Rules Policy Table */}
          <div className="pt-6 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-indigo-600" /> Permitted Lifecycle
              Operations
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Auto-Close on Expiry</span>
                <span
                  className={`font-bold mt-1 inline-block ${
                    plan.autoCloseOnExpiry ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {plan.autoCloseOnExpiry ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Early Closure Permitted</span>
                <span
                  className={`font-bold mt-1 inline-block ${
                    plan.allowEarlyClosure ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {plan.allowEarlyClosure ? '✓ Allowed' : '✗ Disallowed'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Pausing Permitted</span>
                <span
                  className={`font-bold mt-1 inline-block ${
                    plan.allowPause ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {plan.allowPause ? '✓ Allowed' : '✗ Disallowed'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">Renewal Permitted</span>
                <span
                  className={`font-bold mt-1 inline-block ${
                    plan.allowRenewal ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {plan.allowRenewal ? '✓ Allowed' : '✗ Disallowed'}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Lifecycle Action Control Center (Admin only) */}
          {isAdmin && (
            <div className="pt-6 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center">
                <Layers className="w-4 h-4 mr-1.5 text-indigo-600" /> Plan Lifecycle Control Center
              </h2>
              <div className="flex flex-wrap gap-3">
                {plan.status === PlanStatus.ACTIVE && plan.allowPause && (
                  <button
                    onClick={() => setActionType('pause')}
                    className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <Pause className="w-4 h-4 mr-1.5" /> Pause Plan
                  </button>
                )}

                {plan.status === PlanStatus.PAUSED && (
                  <button
                    onClick={() => setActionType('resume')}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <Play className="w-4 h-4 mr-1.5" /> Resume Plan
                  </button>
                )}

                {plan.status !== PlanStatus.CLOSED && plan.allowEarlyClosure && (
                  <button
                    onClick={() => setActionType('close')}
                    className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <XOctagon className="w-4 h-4 mr-1.5" /> Close Plan Early
                  </button>
                )}

                {plan.allowRenewal && (
                  <button
                    onClick={() => setIsRenewalModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Renew Plan Expiry
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Lifecycle Actions */}
      <ConfirmationModal
        isOpen={!!actionType}
        title={
          actionType === 'pause'
            ? 'Pause Plan'
            : actionType === 'resume'
            ? 'Resume Plan'
            : actionType === 'close'
            ? 'Close Plan Early'
            : plan.isActive
            ? 'Deactivate Plan'
            : 'Activate Plan'
        }
        message={
          actionType === 'close'
            ? `Closing "${plan.name}" terminates its availability before validity ends. Customer subscriptions that are already active will NOT be cancelled, but no new subscriptions can be created under this plan.`
            : `Are you sure you want to proceed with this lifecycle transition for "${plan.name}"?`
        }
        confirmLabel="Confirm Action"
        isDangerous={actionType === 'close'}
        isLoading={isExecuting}
        onConfirm={handleConfirmLifecycleAction}
        onCancel={() => setActionType(null)}
      />

      {/* Renewal Modal */}
      {isRenewalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Renew Subscription Plan</h3>
            <p className="text-xs text-slate-500 mb-4">
              Extend plan validity to a future date. If the plan was closed, renewal reactivates it.
            </p>

            <form onSubmit={handleRenewalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Validity Expiry Date *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenewalModalOpen(false)}
                  disabled={isRenewing}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenewing}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center"
                >
                  {isRenewing && (
                    <span className="w-3.5 h-3.5 mr-1.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  )}
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
