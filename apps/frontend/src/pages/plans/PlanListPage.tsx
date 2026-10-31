import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { BillingFrequency, PlanStatus, UserRole } from '@odoo/shared';
import {
  CalendarRange,
  Search,
  Plus,
  ArrowRight,
  Clock,
  RotateCw,
  Play,
  Pause,
  XOctagon,
  Calendar,
} from 'lucide-react';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface PlanListItem {
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
}

export const PlanListPage: React.FC = () => {
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sweep Expiry state
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);

  // Quick action confirmation modal
  const [selectedPlan, setSelectedPlan] = useState<PlanListItem | null>(null);
  const [actionType, setActionType] = useState<'pause' | 'resume' | 'close' | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  const fetchPlans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (frequencyFilter) params.billingFrequency = frequencyFilter;
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/plans', { params });
      if (res.data?.success) {
        setPlans(res.data.data || []);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to fetch subscription plans');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [statusFilter, frequencyFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPlans();
  };

  const handleSweepExpiry = async () => {
    setIsSweeping(true);
    setSweepResult(null);
    try {
      const res = await apiClient.post('/plans/sweep-expiry');
      if (res.data?.success) {
        const count = res.data.data?.closedPlansCount ?? 0;
        setSweepResult(`Sweep complete: ${count} expired plan(s) automatically closed.`);
        await fetchPlans();
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setSweepResult(`Sweep failed: ${errorObj.message || 'Unknown error'}`);
    } finally {
      setIsSweeping(false);
    }
  };

  const promptAction = (p: PlanListItem, action: 'pause' | 'resume' | 'close') => {
    setSelectedPlan(p);
    setActionType(action);
  };

  const handleConfirmAction = async () => {
    if (!selectedPlan || !actionType) return;
    setIsExecutingAction(true);
    try {
      let endpoint = '';
      if (actionType === 'pause') endpoint = `/plans/${selectedPlan.id}/pause`;
      else if (actionType === 'resume') endpoint = `/plans/${selectedPlan.id}/resume`;
      else if (actionType === 'close') endpoint = `/plans/${selectedPlan.id}/close`;

      const res = await apiClient.post(endpoint);
      if (res.data?.success && res.data?.data) {
        setPlans((prev) =>
          prev.map((item) => (item.id === selectedPlan.id ? res.data.data : item))
        );
        setSelectedPlan(null);
        setActionType(null);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      alert(errorObj.message || `Failed to execute ${actionType}`);
    } finally {
      setIsExecutingAction(false);
    }
  };

  const statusBadge = (status: PlanStatus) => {
    switch (status) {
      case PlanStatus.ACTIVE:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case PlanStatus.PAUSED:
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case PlanStatus.CLOSED:
        return 'bg-slate-200 text-slate-700 border-slate-300';
    }
  };

  const frequencyBadge = (f: BillingFrequency) => {
    switch (f) {
      case BillingFrequency.DAILY:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case BillingFrequency.WEEKLY:
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case BillingFrequency.MONTHLY:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case BillingFrequency.YEARLY:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <CalendarRange className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
            <p className="text-sm text-slate-500">
              Configure recurring billing frequencies, availability windows, and lifecycle rules
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSweepExpiry}
              disabled={isSweeping}
              title="Trigger background check to auto-close plans past validity date"
              className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${isSweeping ? 'animate-spin' : ''}`} />
              Sweep Expired Plans
            </button>

            <Link
              to="/plans/new"
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create New Plan
            </Link>
          </div>
        )}
      </div>

      {sweepResult && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs rounded-xl flex items-center justify-between">
          <span>{sweepResult}</span>
          <button onClick={() => setSweepResult(null)} className="text-xs font-bold text-indigo-600">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search plan name, code, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Frequencies</option>
            <option value={BillingFrequency.DAILY}>Daily</option>
            <option value={BillingFrequency.WEEKLY}>Weekly</option>
            <option value={BillingFrequency.MONTHLY}>Monthly</option>
            <option value={BillingFrequency.YEARLY}>Yearly</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value={PlanStatus.ACTIVE}>Active</option>
            <option value={PlanStatus.PAUSED}>Paused</option>
            <option value={PlanStatus.CLOSED}>Closed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Plans Grid */}
      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">Loading subscription plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-base font-semibold text-slate-800">No subscription plans found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting search filters or create a plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${frequencyBadge(
                      p.billingFrequency
                    )}`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {p.billingFrequency}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${statusBadge(
                      p.status
                    )}`}
                  >
                    {p.status}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-900 leading-snug line-clamp-1">{p.name}</h2>
                <span className="text-xs font-mono font-medium text-slate-400 block mb-2">
                  CODE: {p.code}
                </span>

                <div className="my-3 py-3 px-4 bg-slate-50 rounded-xl flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-slate-900">
                      ${p.basePrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">/ {p.billingFrequency.toLowerCase()}</span>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    MOQ: {p.minimumQuantity}
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 min-h-[2rem]">
                  {p.description || 'Standard subscription recurring terms.'}
                </p>

                {/* Validity Range */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] text-slate-500">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {p.validUntil ? (
                    <span>
                      Expires:{' '}
                      <strong className="text-slate-700">
                        {new Date(p.validUntil).toLocaleDateString()}
                      </strong>
                    </span>
                  ) : (
                    <span>No validity expiry (Indefinite)</span>
                  )}
                </div>

                {/* Policy Flags Strip */}
                <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                  {p.autoCloseOnExpiry && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">Auto-Close</span>
                  )}
                  {p.allowPause && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Pausable</span>
                  )}
                  {p.allowEarlyClosure && (
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">Early-Close</span>
                  )}
                  {p.allowRenewal && (
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">Renewable</span>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to={`/plans/${p.id}`}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center"
                >
                  Details & Policies <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>

                {isAdmin && (
                  <div className="flex items-center space-x-1">
                    {p.status === PlanStatus.ACTIVE && p.allowPause && (
                      <button
                        onClick={() => promptAction(p, 'pause')}
                        title="Pause Plan"
                        className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {p.status === PlanStatus.PAUSED && (
                      <button
                        onClick={() => promptAction(p, 'resume')}
                        title="Resume Plan"
                        className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {p.status !== PlanStatus.CLOSED && p.allowEarlyClosure && (
                      <button
                        onClick={() => promptAction(p, 'close')}
                        title="Close Early"
                        className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                      >
                        <XOctagon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Link
                      to={`/plans/${p.id}/edit`}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 ml-1 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Lifecycle Actions */}
      <ConfirmationModal
        isOpen={!!selectedPlan && !!actionType}
        title={
          actionType === 'pause'
            ? 'Pause Subscription Plan'
            : actionType === 'resume'
            ? 'Resume Subscription Plan'
            : 'Close Subscription Plan Early'
        }
        message={`Are you sure you want to ${actionType} the plan "${selectedPlan?.name}" (${selectedPlan?.code})? ${
          actionType === 'close'
            ? 'Closing the plan prevents any new customer subscriptions from adopting it.'
            : ''
        }`}
        confirmLabel={
          actionType === 'pause' ? 'Pause Plan' : actionType === 'resume' ? 'Resume Plan' : 'Close Plan'
        }
        isDangerous={actionType === 'close'}
        isLoading={isExecutingAction}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setSelectedPlan(null);
          setActionType(null);
        }}
      />
    </div>
  );
};
