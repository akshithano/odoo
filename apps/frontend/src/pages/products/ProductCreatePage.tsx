import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { ProductType } from '@odoo/shared';
import { PackagePlus, ArrowLeft, AlertCircle, Plus, Trash2, CheckCircle } from 'lucide-react';

interface VariantInput {
  variantName: string;
  sku: string;
  attributeName: string;
  attributeValue: string;
  additionalPrice: number;
}

export const ProductCreatePage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: ProductType.SERVICE,
    description: '',
    internalNotes: '',
    salesPrice: 0,
    costPrice: 0,
  });

  const [variants, setVariants] = useState<VariantInput[]>([
    {
      variantName: 'Standard Variant',
      sku: '',
      attributeName: 'Brand',
      attributeValue: 'Standard',
      additionalPrice: 0,
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'salesPrice' || name === 'costPrice') {
      setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleVariantChange = (index: number, field: keyof VariantInput, value: string | number) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        variantName: '',
        sku: '',
        attributeName: 'Brand',
        attributeValue: '',
        additionalPrice: 0,
      },
    ]);
  };

  const removeVariantRow = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (formData.salesPrice < 0 || formData.costPrice < 0) {
      setError('Prices cannot be negative');
      return;
    }

    setIsLoading(true);

    try {
      // Filter out variants that don't have name or SKU
      const validVariants = variants
        .filter((v) => v.variantName.trim() && v.sku.trim())
        .map((v) => ({
          variantName: v.variantName.trim(),
          sku: v.sku.trim().toUpperCase(),
          attributeName: v.attributeName.trim() || undefined,
          attributeValue: v.attributeValue.trim() || undefined,
          additionalPrice: Number(v.additionalPrice) || 0,
        }));

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        type: formData.type,
        description: formData.description.trim() || undefined,
        internalNotes: formData.internalNotes.trim() || undefined,
        salesPrice: formData.salesPrice,
        costPrice: formData.costPrice,
        variants: validVariants,
      };

      const res = await apiClient.post('/products', payload);

      if (res.data?.success) {
        setSuccess('Product created successfully!');
        setTimeout(() => {
          navigate(`/products/${res.data.data.id}`);
        }, 1200);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string; details?: Array<{ message: string }> };
      if (errorObj.details && errorObj.details.length > 0) {
        setError(errorObj.details.map((d) => d.message).join(', '));
      } else {
        setError(errorObj.message || 'Failed to create product');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/products"
        className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Products
      </Link>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <PackagePlus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create New Catalog Product</h1>
            <p className="text-xs text-slate-500">
              Define product baseline pricing, types, and configurable variants
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
          {/* Basic Details */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              General Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleFieldChange}
                  placeholder="e.g. Odoo Enterprise ERP Suite"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product Code (SKU Root) *
                </label>
                <input
                  type="text"
                  required
                  name="code"
                  value={formData.code}
                  onChange={handleFieldChange}
                  placeholder="e.g. PRD-ODOO-01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Type *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleFieldChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={ProductType.SERVICE}>Service</option>
                  <option value={ProductType.DIGITAL}>Digital</option>
                  <option value={ProductType.PHYSICAL}>Physical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sales Price (Base ₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  name="salesPrice"
                  value={formData.salesPrice}
                  onChange={handleFieldChange}
                  placeholder="1000.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cost Price (Internal ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="costPrice"
                  value={formData.costPrice}
                  onChange={handleFieldChange}
                  placeholder="400.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  name="description"
                  value={formData.description}
                  onChange={handleFieldChange}
                  placeholder="Customer-facing product overview and specifications..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Internal Engineering & Operational Notes
                </label>
                <textarea
                  rows={2}
                  name="internalNotes"
                  value={formData.internalNotes}
                  onChange={handleFieldChange}
                  placeholder="Notes for staff, license requirements, backend provisioning details..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Product Variants Section */}
          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Product Variants & Differential Pricing
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  e.g. Attribute: Brand, Value: Odoo, Additional Price: ₹560
                </p>
              </div>
              <button
                type="button"
                onClick={addVariantRow}
                className="inline-flex items-center text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Variant Row
              </button>
            </div>

            <div className="space-y-3">
              {variants.map((v, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-6 gap-3 items-center"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Variant Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={v.variantName}
                      onChange={(e) => handleVariantChange(idx, 'variantName', e.target.value)}
                      placeholder="e.g. Odoo Brand Certified"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      SKU Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={v.sku}
                      onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                      placeholder="e.g. SKU-ODOO-BRAND"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs uppercase font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Attribute (e.g. Brand)
                    </label>
                    <input
                      type="text"
                      value={v.attributeName}
                      onChange={(e) => handleVariantChange(idx, 'attributeName', e.target.value)}
                      placeholder="Brand"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Attribute Value (e.g. Odoo)
                    </label>
                    <input
                      type="text"
                      value={v.attributeValue}
                      onChange={(e) => handleVariantChange(idx, 'attributeValue', e.target.value)}
                      placeholder="Odoo"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        +Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.additionalPrice}
                        onChange={(e) =>
                          handleVariantChange(idx, 'additionalPrice', parseFloat(e.target.value) || 0)
                        }
                        placeholder="560.00"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVariantRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors mt-5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
              'Save Catalog Product & Variants'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
