import React, { useEffect, useState } from 'react';
import { Server, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import { HealthCheckResult, ApiResponse } from '@odoo/shared';

export const HomePage: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ApiResponse<HealthCheckResult>>('/health');
      if (isMountedRef.current) setHealthData(response.data.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to connect to backend service';
      if (isMountedRef.current) setError(message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Subscription Management & Billing System
          </h1>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            Centralized operations platform for subscription lifecycles, tiered & usage-based
            pricing, automated recurring invoicing, payment gateways, fraud detection, and executive
            revenue intelligence.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
              Node.js + Express
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
              React 18 + Vite
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
              PostgreSQL 16 + Prisma
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
              Redis 7 + BullMQ
            </span>
          </div>
        </div>
      </div>

      {/* System Health Status Widget */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <Server className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">Shared Backend Health Probe</h2>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh Probe
          </button>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="py-6 flex items-center justify-center text-sm text-slate-500">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin text-indigo-600" />
              Probing backend health endpoint...
            </div>
          ) : error ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3 text-amber-800 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Backend Unreachable or Initializing</p>
                <p className="text-xs text-amber-700 mt-1">{error}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Ensure the backend API is running via{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded">npm run dev:backend</code>.
                </p>
              </div>
            </div>
          ) : healthData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    PostgreSQL Database
                  </span>
                  {healthData.services.database.status === 'healthy' ? (
                    <span className="flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                      Standby
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  {healthData.services.database.message}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    Redis 7 Engine
                  </span>
                  {healthData.services.redis.status === 'healthy' ? (
                    <span className="flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                      Standby
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2">{healthData.services.redis.message}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    BullMQ Workers
                  </span>
                  {healthData.services.queue.status === 'healthy' ? (
                    <span className="flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Ready
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                      Standby
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2">{healthData.services.queue.message}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Module Allocation Overview */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Four-Member Architecture Allocation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm mb-3">
                M1
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Member 1: Identity & Catalog</h3>
              <p className="text-xs text-slate-500 mt-1">
                Authentication, password complexity, JWT & RBAC, customer isolation, products,
                variants, and plans.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              <a
                href="/products"
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors"
              >
                Products & Variants
              </a>
              <a
                href="/plans"
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors"
              >
                Subscription Plans
              </a>
              <a
                href="/users"
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors"
              >
                Users & RBAC
              </a>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm mb-3">
                M2
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Member 2: Subscriptions & Pricing
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Quotations, subscription lifecycles, tiered (graduated/volume) pricing, usage
                ingestion, and proration.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-emerald-600">
              Assigned Module Directory:{' '}
              <code className="block text-[11px] mt-1 text-slate-700">
                apps/frontend/src/modules/member2_subs
              </code>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm mb-3">
                M3
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Member 3: Invoicing & Payments
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Automated recurring billing, duplicate billing lock, tax rules, discount limits,
                gateways, and dunning retries.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-purple-600">
              Assigned Module Directory:{' '}
              <code className="block text-[11px] mt-1 text-slate-700">
                apps/frontend/src/modules/member3_billing
              </code>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm mb-3">
                M4
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Member 4: Analytics & Operations
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Executive BI dashboard (MRR/ARR), 8-vector fraud rule engine, customer health
                scoring, audit logs, and surveys.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-rose-600">
              Assigned Module Directory:{' '}
              <code className="block text-[11px] mt-1 text-slate-700">
                apps/frontend/src/modules/member4_ops
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
