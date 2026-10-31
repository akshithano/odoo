import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ProductType, UserRole } from '@odoo/shared';
import {
  Package,
  Layers,
  ArrowLeft,
  Edit,
  Plus,
  CheckCircle,
  XCircle,
  Calculator,
  Tag,
  FileText,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface Variant {
  id: string;
  productId: string;
  variantName: string;
  sku: string;
  attributeName: string | null;
  attributeValue: string | null;
  additionalPrice: number;
  calculatedPrice: number;
  isActive: boolean;
  createdAt: string;
}

interface ProductDetail {
  id: string;
  name: string;
  code: string;
  type: ProductType;
  description: string | null;
  internalNotes: string | null;
  salesPrice: number;
  costPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  variants: Variant[];
}

export const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Variant Calculator state
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [calculationResult, setCalculationResult] = useState<{
    baseSalesPrice: number;
    variantAdditionalPrice: number;
    finalCalculatedPrice: number;
    attributeName?: string;
    attributeValue?: string;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Add Variant Modal state
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [newVariant, setNewVariant] = useState({
    variantName: '',
    sku: '',
    attributeName: 'Brand',
    attributeValue: '',
    additionalPrice: 0,
  });
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  // Status toggle state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const navigate = useNavigate();

  const fetchProduct = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/products/${id}`);
      if (res.data?.success && res.data?.data) {
        const prod = res.data.data;
        setProduct(prod);
        if (prod.variants && prod.variants.length > 0) {
          setSelectedVariantId(prod.variants[0].id);
          // Initial calculation
          handleCalculate(prod.variants[0].id, prod.id);
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load product details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handleCalculate = async (variantId: string, prodId: string = id!) => {
    if (!variantId || !prodId) return;
    setIsCalculating(true);
    try {
      const res = await apiClient.post(`/products/${prodId}/variants/${variantId}/calculate`);
      if (res.data?.success && res.data?.data) {
        setCalculationResult(res.data.data);
      }
    } catch (err: unknown) {
      console.error('Variant calculation error:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleAddVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setVariantError(null);
    setIsAddingVariant(true);

    try {
      const payload = {
        variantName: newVariant.variantName.trim(),
        sku: newVariant.sku.trim().toUpperCase(),
        attributeName: newVariant.attributeName.trim() || undefined,
        attributeValue: newVariant.attributeValue.trim() || undefined,
        additionalPrice: Number(newVariant.additionalPrice) || 0,
      };

      const res = await apiClient.post(`/products/${product.id}/variants`, payload);
      if (res.data?.success) {
        setIsAddVariantOpen(false);
        setNewVariant({
          variantName: '',
          sku: '',
          attributeName: 'Brand',
          attributeValue: '',
          additionalPrice: 0,
        });
        await fetchProduct();
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setVariantError(errorObj.message || 'Failed to add variant');
    } finally {
      setIsAddingVariant(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!product) return;
    setIsTogglingStatus(true);
    try {
      const newStatus = !product.isActive;
      await apiClient.patch(`/products/${product.id}/status`, { isActive: newStatus });
      setProduct((prev) => (prev ? { ...prev, isActive: newStatus } : null));
      setIsStatusModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      alert(errorObj.message || 'Failed to update product status');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-500">Loading product catalog details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-6 rounded-xl border border-rose-200 text-center">
        <h2 className="text-lg font-bold text-rose-700 mb-2">Error Loading Product</h2>
        <p className="text-sm text-slate-600 mb-6">{error || 'Product not found'}</p>
        <button
          onClick={() => navigate('/products')}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900"
        >
          Back to Product List
        </button>
      </div>
    );
  }

  const margin = product.salesPrice - product.costPrice;
  const marginPercent = product.salesPrice > 0 ? (margin / product.salesPrice) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/products"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Product Catalog
        </Link>

        {isAdmin && (
          <div className="flex items-center space-x-3">
            <Link
              to={`/products/${product.id}/edit`}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5 mr-1" /> Edit Product
            </Link>

            <button
              onClick={() => setIsStatusModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                product.isActive
                  ? 'text-rose-700 border-rose-300 hover:bg-rose-50'
                  : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {product.isActive ? 'Deactivate Product' : 'Activate Product'}
            </button>
          </div>
        )}
      </div>

      {/* Main Product Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                  {product.code}
                </span>
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Tag className="w-3 h-3 mr-1" />
                  {product.type}
                </span>
                {product.isActive ? (
                  <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <CheckCircle className="w-3 h-3 mr-1" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    <XCircle className="w-3 h-3 mr-1" /> Inactive
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">{product.name}</h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                {product.description || 'No public description available.'}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/60 p-6">
          <div className="sm:px-4 py-2">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium">
              <DollarSign className="w-4 h-4 text-indigo-500" />
              <span>Base Sales Price</span>
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              ₹{product.salesPrice.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400">Baseline customer rate before variant</span>
          </div>

          <div className="sm:px-4 py-2">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-medium">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span>Internal Cost Price</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-600">
              ₹{product.costPrice.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400">Underlying COGS tracking</span>
          </div>

          <div className="sm:px-4 py-2">
            <div className="flex items-center space-x-2 text-emerald-600 text-xs font-medium">
              <TrendingUp className="w-4 h-4" />
              <span>Gross Margin</span>
            </div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-600">
              ₹{margin.toFixed(2)}{' '}
              <span className="text-xs font-semibold text-emerald-700">
                ({marginPercent.toFixed(1)}%)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Unit gross contribution</span>
          </div>
        </div>

        {product.internalNotes && (
          <div className="p-6 bg-amber-50/50 border-t border-amber-100 text-xs text-amber-900">
            <span className="font-bold flex items-center mb-1">
              <FileText className="w-3.5 h-3.5 mr-1 text-amber-600" /> Internal Engineering Notes:
            </span>
            <p className="text-amber-800">{product.internalNotes}</p>
          </div>
        )}
      </div>

      {/* Product Variants & Price Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Variants List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Configured Variants</h2>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsAddVariantOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Variant
              </button>
            )}
          </div>

          {product.variants.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center italic">
              No variants defined for this product yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3">Variant Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Attribute</th>
                    <th className="py-2.5 px-3">Additional Price</th>
                    <th className="py-2.5 px-3">Total Calculated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {product.variants.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        handleCalculate(v.id);
                      }}
                      className={`cursor-pointer transition-colors ${
                        selectedVariantId === v.id ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3 font-semibold text-slate-900">{v.variantName}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{v.sku}</td>
                      <td className="py-3 px-3">
                        {v.attributeName && v.attributeValue ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                            {v.attributeName}: {v.attributeValue}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-indigo-700">
                        {v.additionalPrice > 0 ? `+₹${v.additionalPrice.toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        ₹{(product.salesPrice + v.additionalPrice).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Interactive Variant Price Calculator Widget */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-indigo-300 mb-2">
              <Calculator className="w-5 h-5" />
              <h2 className="text-sm font-bold uppercase tracking-wider">
                Variant Price Calculator
              </h2>
            </div>
            <p className="text-xs text-indigo-200 mb-4">
              Demonstrates differential pricing: Selecting brand or feature variant computes final
              billable unit price.
            </p>

            {product.variants.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-indigo-200 mb-1">
                    Select Active Variant:
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => {
                      setSelectedVariantId(e.target.value);
                      handleCalculate(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {product.variants.map((v) => (
                      <option key={v.id} value={v.id} className="text-slate-900">
                        {v.variantName} ({v.attributeName ? `${v.attributeName}: ${v.attributeValue}` : 'Default'}) +₹
                        {v.additionalPrice}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Calculation Breakdown */}
                {isCalculating ? (
                  <div className="py-4 text-center text-xs text-indigo-300">
                    <span className="w-4 h-4 inline-block border-2 border-indigo-400 border-t-white rounded-full animate-spin mr-1" />
                    Calculating price...
                  </div>
                ) : calculationResult ? (
                  <div className="bg-white/10 rounded-xl p-4 border border-white/15 space-y-2 text-xs">
                    <div className="flex justify-between text-indigo-200">
                      <span>Base Sales Price:</span>
                      <span className="font-mono font-bold text-white">
                        ₹{calculationResult.baseSalesPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between text-indigo-200">
                      <span>
                        Variant Premium{' '}
                        {calculationResult.attributeValue ? `(${calculationResult.attributeValue})` : ''}:
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        +₹{calculationResult.variantAdditionalPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/20 flex justify-between items-center text-sm">
                      <span className="font-bold text-white">Final Calculated Price:</span>
                      <span className="text-xl font-extrabold text-emerald-400 font-mono">
                        ₹{calculationResult.finalCalculatedPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-indigo-300 italic">Add variants to activate calculation widget.</p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-indigo-300">
            💡 Supported Example: Selecting the{' '}
            <span className="font-bold text-white">Odoo Brand</span> variant adds{' '}
            <span className="font-bold text-emerald-300">₹560</span> to the base price.
          </div>
        </div>
      </div>

      {/* Add Variant Modal */}
      {isAddVariantOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Product Variant</h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure attributes such as Brand, Capacity, or Tier with differential pricing
            </p>

            {variantError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {variantError}
              </div>
            )}

            <form onSubmit={handleAddVariantSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Variant Name *</label>
                <input
                  type="text"
                  required
                  value={newVariant.variantName}
                  onChange={(e) => setNewVariant({ ...newVariant, variantName: e.target.value })}
                  placeholder="e.g. Odoo Official Brand Certification"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">SKU Code *</label>
                <input
                  type="text"
                  required
                  value={newVariant.sku}
                  onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
                  placeholder="e.g. SKU-ODOO-560"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Attribute Name</label>
                  <input
                    type="text"
                    value={newVariant.attributeName}
                    onChange={(e) => setNewVariant({ ...newVariant, attributeName: e.target.value })}
                    placeholder="Brand"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Attribute Value</label>
                  <input
                    type="text"
                    value={newVariant.attributeValue}
                    onChange={(e) => setNewVariant({ ...newVariant, attributeValue: e.target.value })}
                    placeholder="Odoo"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Additional Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newVariant.additionalPrice}
                  onChange={(e) =>
                    setNewVariant({ ...newVariant, additionalPrice: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="560.00"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddVariantOpen(false)}
                  disabled={isAddingVariant}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingVariant}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  {isAddingVariant ? 'Adding...' : 'Add Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Status Toggle Confirmation */}
      <ConfirmationModal
        isOpen={isStatusModalOpen}
        title={product.isActive ? 'Deactivate Product' : 'Activate Product'}
        message={`Are you sure you want to ${
          product.isActive ? 'deactivate' : 'activate'
        } ${product.name}? ${
          product.isActive
            ? 'Deactivated products will no longer be visible in public subscription offerings.'
            : 'Activated products become available for subscription and quoting.'
        }`}
        confirmLabel={product.isActive ? 'Deactivate' : 'Activate'}
        isDangerous={product.isActive}
        isLoading={isTogglingStatus}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
};
