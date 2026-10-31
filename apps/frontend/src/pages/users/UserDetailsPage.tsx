import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '@odoo/shared';
import { User, Shield, Building, MapPin, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface CustomerDetails {
  id: string;
  companyName: string | null;
  phone: string | null;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string | null;
  billingPostalCode: string;
  billingCountry: string;
  defaultCurrency: string;
}

interface UserDetailRecord {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: CustomerDetails | null;
}

export const UserDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const fetchUser = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/users/${id}`);
      if (res.data?.success && res.data?.data) {
        setUser(res.data.data);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to load user details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [id]);

  const handleConfirmToggleStatus = async () => {
    if (!user) return;
    setIsUpdatingStatus(true);
    try {
      const newStatus = !user.isActive;
      await apiClient.patch(`/users/${user.id}/status`, { isActive: newStatus });
      setUser((prev) => (prev ? { ...prev, isActive: newStatus } : null));
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      alert(errorObj.message || 'Failed to update user status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-500">Loading user profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-6 rounded-xl border border-rose-200 shadow-sm text-center">
        <h2 className="text-lg font-bold text-rose-700 mb-2">Error Loading User</h2>
        <p className="text-sm text-slate-600 mb-6">{error || 'User not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header and Back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/users"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Users
        </Link>

        {isAdmin && user.id !== currentUser?.id && (
          <button
            onClick={() => setIsModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              user.isActive
                ? 'text-rose-700 border-rose-300 hover:bg-rose-50'
                : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            {user.isActive ? 'Deactivate User Account' : 'Activate User Account'}
          </button>
        )}
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center font-bold text-2xl text-indigo-300">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-indigo-200 text-sm font-mono mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 backdrop-blur-xs">
              <Shield className="w-3.5 h-3.5 mr-1 text-indigo-400" />
              Role: {user.role}
            </span>
            {user.isActive ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <XCircle className="w-3.5 h-3.5 mr-1" /> Deactivated
              </span>
            )}
          </div>
        </div>

        {/* Account Metadata Grid */}
        <div className="p-6 sm:p-8 space-y-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
              <User className="w-4 h-4 mr-1.5 text-indigo-600" /> System Account Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-xs text-slate-500 block">User Identifier (UUID)</span>
                <span className="font-mono text-xs text-slate-800 break-all">{user.id}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-xs text-slate-500 block">Account Registration Date</span>
                <span className="font-medium text-slate-800">
                  {new Date(user.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <span className="text-xs text-slate-500 block">Last Profile Update</span>
                <span className="font-medium text-slate-800">
                  {new Date(user.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Linked Customer Profile */}
          {user.customer ? (
            <div className="pt-6 border-t border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
                <Building className="w-4 h-4 mr-1.5 text-emerald-600" /> Linked Customer Billing Profile
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <span className="text-xs text-slate-500 block">Customer ID</span>
                  <span className="font-mono text-xs text-emerald-800 break-all">
                    {user.customer.id}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <span className="text-xs text-slate-500 block">Company / Organization</span>
                  <span className="font-semibold text-slate-800">
                    {user.customer.companyName || 'Individual Subscriber'}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <span className="text-xs text-slate-500 block">Direct Contact Phone</span>
                  <span className="font-medium text-slate-800">
                    {user.customer.phone || 'None provided'}
                  </span>
                </div>
                <div className="sm:col-span-2 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <span className="text-xs text-slate-500 block mb-1">
                    <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-400" /> Billing Address
                  </span>
                  <span className="font-medium text-slate-800 block">
                    {user.customer.billingAddressLine1}
                  </span>
                  <span className="text-slate-600 text-xs">
                    {user.customer.billingCity}
                    {user.customer.billingState ? `, ${user.customer.billingState}` : ''}{' '}
                    {user.customer.billingPostalCode}, {user.customer.billingCountry}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <span className="text-xs text-slate-500 block">Default Currency</span>
                  <span className="font-bold text-emerald-700">
                    {user.customer.defaultCurrency}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-6 border-t border-slate-100 text-xs text-slate-500 italic">
              No customer organization profile linked (Internal {user.role} role).
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        title={user.isActive ? 'Deactivate Account' : 'Activate Account'}
        message={`Are you sure you want to ${
          user.isActive ? 'deactivate' : 'activate'
        } ${user.firstName} ${user.lastName}?`}
        confirmLabel={user.isActive ? 'Deactivate' : 'Activate'}
        isDangerous={user.isActive}
        isLoading={isUpdatingStatus}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setIsModalOpen(false)}
      />
    </div>
  );
};
