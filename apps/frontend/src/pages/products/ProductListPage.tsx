import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ProductType, UserRole } from '@odoo/shared';
import { Package, Search, Plus, CheckCircle, XCircle, ArrowRight, Tag, Layers } from 'lucide-react';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface ProductListItem {
  id: string;
  name: string;
  code: string;
  type: ProductType;
  description: string | null;
  salesPrice: number;
  costPrice: number;
  isActive: boolean;
  variants: Array<{
    id: string;
    variantName: string;
    sku: string;
    attributeName: string | null;
    attributeValue: string | null;
    additionalPrice: number;
    calculatedPrice: number;
  }>;
}

export const ProductListPage: React.FC = () => {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle modal
  const [targetProduct, setTargetProduct] = useState<ProductListItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | boolean> = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.isActive = statusFilter === 'active';
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/products', { params });
      if (res.data?.success) {
        setProducts(res.data.data || []);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to fetch catalog products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const promptToggleStatus = (p: ProductListItem) => {
    if (!isAdmin) return;
    setTargetProduct(p);
    setIsModalOpen(true);
  };

  const handleConfirmToggle = async () => {
    if (!targetProduct) return;
    setIsToggling(true);
    try {
      const newStatus = !targetProduct.isActive;
      await apiClient.patch(`/products/${targetProduct.id}/status`, { isActive: newStatus });
      setProducts((prev) =>
        prev.map((item) => (item.id === targetProduct.id ? { ...item, isActive: newStatus } : item))
      );
      setIsModalOpen(false);
      setTargetProduct(null);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      alert(errorObj.message || 'Failed to update product status');
    } finally {
      setIsToggling(false);
    }
  };

  const typeBadge = (type: ProductType) => {
    switch (type) {
      case ProductType.SERVICE:
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case ProductType.PHYSICAL:
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case ProductType.DIGITAL:
        return 'bg-violet-100 text-violet-800 border-violet-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
            <p className="text-sm text-slate-500">
              Manage core products, service items, and configurable brand variants
            </p>
          </div>
        </div>

        {isAdmin && (
          <Link
            to="/products/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create New Product
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search product name, code, or description..."
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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value={ProductType.SERVICE}>Service</option>
            <option value={ProductType.DIGITAL}>Digital</option>
            <option value={ProductType.PHYSICAL}>Physical</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Deactivated Only</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Product List Cards / Table */}
      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">Loading catalog...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-base font-semibold text-slate-800">No products found</p>
          <p className="text-sm text-slate-500 mt-1">
            Try adjusting search filters or add a new product.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${typeBadge(
                      p.type
                    )}`}
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {p.type}
                  </span>
                  {p.isActive ? (
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle className="w-3 h-3 mr-1" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      <XCircle className="w-3 h-3 mr-1" /> Inactive
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 leading-snug line-clamp-1">{p.name}</h2>
                <span className="text-xs font-mono font-medium text-slate-400 block mb-2">
                  CODE: {p.code}
                </span>

                <p className="text-xs text-slate-600 line-clamp-2 min-h-[2rem]">
                  {p.description || 'No description provided.'}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg">
                    <span className="text-slate-400 block">Sales Price</span>
                    <span className="text-base font-bold text-slate-900">
                      ₹{p.salesPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg">
                    <span className="text-slate-400 block">Cost Price</span>
                    <span className="text-base font-bold text-slate-600">
                      ₹{p.costPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Variants Preview */}
                <div className="mt-3 flex items-center text-xs text-slate-500 font-medium">
                  <Layers className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                  {p.variants.length} variant{p.variants.length === 1 ? '' : 's'} configured
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to={`/products/${p.id}`}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center"
                >
                  View Details & Variants <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>

                {isAdmin && (
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/products/${p.id}/edit`}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      Edit
                    </Link>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => promptToggleStatus(p)}
                      className={`text-xs font-semibold ${
                        p.isActive ? 'text-rose-600 hover:text-rose-800' : 'text-emerald-600 hover:text-emerald-800'
                      }`}
                    >
                      {p.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isModalOpen}
        title={targetProduct?.isActive ? 'Deactivate Product' : 'Activate Product'}
        message={`Are you sure you want to ${
          targetProduct?.isActive ? 'deactivate' : 'activate'
        } "${targetProduct?.name}" (${targetProduct?.code})?`}
        confirmLabel={targetProduct?.isActive ? 'Deactivate Product' : 'Activate Product'}
        isDangerous={targetProduct?.isActive}
        isLoading={isToggling}
        onConfirm={handleConfirmToggle}
        onCancel={() => {
          setIsModalOpen(false);
          setTargetProduct(null);
        }}
      />
    </div>
  );
};
