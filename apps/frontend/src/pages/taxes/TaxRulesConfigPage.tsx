import React, { useState, useEffect } from 'react';
import {
  Percent,
  PlusCircle,
  CheckCircle,
  XCircle,
  Edit2,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { taxesApi } from '../../api/taxes';
import { TaxRuleDto } from '@odoo/shared';

export const TaxRulesConfigPage: React.FC = () => {
  const [rules, setRules] = useState<TaxRuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRuleDto | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [isCompound, setIsCompound] = useState(false);

  // Simulator state
  const [simAmount, setSimAmount] = useState('1000');
  const [simResult, setSimResult] = useState<any | null>(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await taxesApi.getTaxRules();
      setRules(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tax rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    setName('');
    setRate('');
    setCountry('');
    setState('');
    setIsCompound(false);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: TaxRuleDto) => {
    setEditingRule(rule);
    setName(rule.name);
    setRate(rule.ratePercentage.toString());
    setCountry(rule.country || '');
    setState(rule.state || '');
    setIsCompound(rule.isCompound);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingRule) {
        await taxesApi.updateTaxRule(editingRule.id, {
          name,
          ratePercentage: parseFloat(rate),
          country: country || null,
          state: state || null,
          isCompound,
        });
      } else {
        await taxesApi.createTaxRule({
          name,
          ratePercentage: parseFloat(rate),
          country: country || null,
          state: state || null,
          isCompound,
        });
      }
      setIsModalOpen(false);
      fetchRules();
    } catch (err: any) {
      setError(err.message || 'Failed to save tax rule');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await taxesApi.toggleActive(id);
      fetchRules();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status');
    }
  };

  const handleSimulate = async () => {
    try {
      const res = await taxesApi.calculateTax(parseFloat(simAmount));
      setSimResult(res);
    } catch (err: any) {
      setError(err.message || 'Simulation error');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Percent className="w-7 h-7 mr-2 text-indigo-600" />
            Tax Configuration & Calculation Engine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure dynamic multi-tier, percentage-based, and compound tax rules for automated invoice generation.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4 mr-1.5" /> Add Tax Rule
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Tax Rules Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-600" />
            Loading tax rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Percent className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">No Tax Rules Configured</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Add your first tax rule (e.g. GST 18%, VAT 20%) to enable automated invoice tax calculations.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" /> Configure Tax Rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Tax Name</th>
                  <th className="py-3 px-4">Rate (%)</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{rule.name}</td>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                      {Number(rule.ratePercentage).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {rule.country || 'Global'}{rule.state ? ` (${rule.state})` : ''}
                    </td>
                    <td className="py-3 px-4">
                      {rule.isCompound ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          Compound Tax
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggle(rule.id)}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                          rule.isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {rule.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openEditModal(rule)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Tax Engine Simulator */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-bold text-slate-900 flex items-center mb-1">
          <Calculator className="w-5 h-5 mr-2 text-indigo-600" /> Live Tax Calculation Simulator
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Simulate how the backend calculates active standard and compound taxes for any base invoice subtotal.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-60">
            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
            <input
              type="number"
              step="1"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
              placeholder="Base amount"
            />
          </div>
          <button
            onClick={handleSimulate}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Compute Taxes
          </button>
        </div>

        {simResult && (
          <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200 grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Effective Tax Rate</span>
              <p className="text-lg font-bold text-indigo-600 mt-0.5">{simResult.taxRate}%</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Total Tax Amount</span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">${simResult.taxAmount.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Grand Total With Tax</span>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">${simResult.totalWithTax.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900">
              {editingRule ? 'Edit Tax Rule' : 'Create Tax Rule'}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tax Name</label>
              <input
                type="text"
                required
                placeholder="e.g. VAT Standard, GST 18%, State Sales Tax"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Rate Percentage (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                placeholder="e.g. 18.00"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Country (2-Letter ISO)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="e.g. US, IN"
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">State / Province</label>
                <input
                  type="text"
                  placeholder="e.g. CA, NY"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="isCompoundCheck"
                checked={isCompound}
                onChange={(e) => setIsCompound(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <label htmlFor="isCompoundCheck" className="text-sm font-medium text-slate-700">
                Compound Tax (Applies on top of previous taxes)
              </label>
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
                {editingRule ? 'Save Changes' : 'Create Tax Rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
