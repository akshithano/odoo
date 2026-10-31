import React, { useState, useEffect } from 'react';
import {
  Tag,
  PlusCircle,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { discountsApi } from '../../api/discounts';
import { DiscountDto } from '@odoo/shared';

export const DiscountsConfigPage: React.FC = () => {
  const [discounts, setDiscounts] = useState<DiscountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [type, setType] = useState('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('0');
  const [minQty, setMinQty] = useState('0');
  const [maxRedemptions, setMaxRedemptions] = useState('100');
  const [maxPerCustomer, setMaxPerCustomer] = useState('1');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Validator test state
  const [testCode, setTestCode] = useState('');
  const [testAmount, setTestAmount] = useState('150');
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const data = await discountsApi.getDiscounts();
      setDiscounts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load discount rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await discountsApi.createDiscount({
        code: code.toUpperCase().trim(),
        type,
        value: parseFloat(value),
        minPurchaseAmount: parseFloat(minPurchase),
        minQuantity: parseInt(minQty, 10),
        maxRedemptions: parseInt(maxRedemptions, 10),
        maxPerCustomer: parseInt(maxPerCustomer, 10),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      setIsModalOpen(false);
      setCode('');
      setValue('');
      fetchDiscounts();
    } catch (err: any) {
      setError(err.message || 'Failed to create discount');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await discountsApi.toggleActive(id);
      fetchDiscounts();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status');
    }
  };

  const handleTestDiscount = async () => {
    setTestResult(null);
    try {
      const res = await discountsApi.validateDiscount({
        code: testCode,
        customerId: 'demo_customer_id',
        purchaseAmount: parseFloat(testAmount),
      });
      setTestResult({ success: true, data: res });
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Validation failed' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Tag className="w-7 h-7 mr-2 text-indigo-600" />
            Discounts & Promotional Rules
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure coupons, percentage-based discounts, minimum order requirements, and atomic redemption limits.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4 mr-1.5" /> Create Coupon
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Discounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-600" />
            Loading discounts...
          </div>
        ) : discounts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Tag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">No Discounts Configured</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Create promotional discount codes for customer retention and marketing campaigns.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" /> Create Discount
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Min Spend</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {discounts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 tracking-wider">
                      {d.code}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {d.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {d.type === 'PERCENTAGE' ? `${Number(d.value)}%` : `$${Number(d.value).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      ${Number(d.minPurchaseAmount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-medium text-slate-800">{d.currentRedemptions}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">{d.maxRedemptions}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(d.endDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggle(d.id)}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                          d.isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {d.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Coupon Tester Simulator */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-bold text-slate-900 flex items-center mb-1">
          <CheckCircle className="w-5 h-5 mr-2 text-indigo-600" /> Coupon Eligibility Validator
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Test if a coupon is valid, not expired, within usage bounds, and calculate its resulting discount.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <input
            type="text"
            placeholder="Enter Coupon (e.g. SAVE20)"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value.toUpperCase())}
            className="w-full sm:w-60 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
          />
          <div className="relative w-full sm:w-48">
            <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
            <input
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              placeholder="Order amount"
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleTestDiscount}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            Validate Code
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-sm ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {testResult.success ? (
              <div className="flex items-center justify-between">
                <div>
                  <strong>Coupon Qualified!</strong> Discount Applied:{' '}
                  <span className="font-bold">${testResult.data.discountAmount.toFixed(2)}</span>
                </div>
                <div className="font-bold">
                  New Order Total: ${testResult.data.newTotal.toFixed(2)}
                </div>
              </div>
            ) : (
              <div>
                <strong>Ineligible:</strong> {testResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900">Create Promotional Discount</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Coupon Code</label>
              <input
                type="text"
                required
                placeholder="e.g. BLACKFRIDAY50, ENTERPRISE10"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Discount Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Cash ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Value</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={type === 'PERCENTAGE' ? 'e.g. 15' : 'e.g. 50'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Min Spend ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Min Quantity</label>
                <input
                  type="number"
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Global Max Redemptions
                </label>
                <input
                  type="number"
                  required
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Max Per Customer
                </label>
                <input
                  type="number"
                  required
                  value={maxPerCustomer}
                  onChange={(e) => setMaxPerCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
              >
                Create Discount
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
