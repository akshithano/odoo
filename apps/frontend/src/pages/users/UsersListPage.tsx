import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '@odoo/shared';
import { Users, Search, Plus, CheckCircle, XCircle, ArrowRight, Shield } from 'lucide-react';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface UserListItem {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  customerId: string | null;
  companyName: string | null;
  createdAt: string;
}

interface Meta {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const UsersListPage: React.FC = () => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status modal state
  const [targetUser, setTargetUser] = useState<UserListItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (roleFilter) params.role = roleFilter;
      if (search.trim()) params.search = search.trim();

      const res = await apiClient.get('/users', { params });
      if (res.data?.success) {
        setUsers(res.data.data || []);
        setMeta(res.data.meta || null);
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const promptToggleStatus = (u: UserListItem) => {
    if (!isAdmin) return;
    setTargetUser(u);
    setIsModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!targetUser) return;
    setIsUpdatingStatus(true);
    try {
      const newStatus = !targetUser.isActive;
      await apiClient.patch(`/users/${targetUser.id}/status`, { isActive: newStatus });
      setUsers((prev) =>
        prev.map((item) => (item.id === targetUser.id ? { ...item, isActive: newStatus } : item))
      );
      setIsModalOpen(false);
      setTargetUser(null);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      alert(errorObj.message || 'Failed to update user status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const roleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case UserRole.STAFF:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case UserRole.CUSTOMER:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
              <p className="text-sm text-slate-500">
                Manage administrators, operational staff, and customer accounts
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <Link
            to="/users/staff/create"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Provision Internal Staff
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or email..."
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
          <label className="text-xs font-semibold text-slate-600 uppercase">Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Roles</option>
            <option value={UserRole.ADMIN}>Admin</option>
            <option value={UserRole.STAFF}>Internal Staff</option>
            <option value={UserRole.CUSTOMER}>Customer</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading user catalog...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-base font-semibold text-slate-800">No users found</p>
            <p className="text-sm text-slate-500 mt-1">
              Try adjusting your search criteria or role filters
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Organization / Customer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleBadge(
                          u.role
                        )}`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {u.companyName ? (
                        <span className="font-medium">{u.companyName}</span>
                      ) : (
                        <span className="text-slate-400 italic">Internal User</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <XCircle className="w-3 h-3 mr-1" /> Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {isAdmin && (
                          <button
                            onClick={() => promptToggleStatus(u)}
                            className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                              u.isActive
                                ? 'text-rose-700 border-rose-200 hover:bg-rose-50'
                                : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        <Link
                          to={`/users/${u.id}`}
                          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-1"
                        >
                          Details <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-bold">{meta.page}</span> of{' '}
              <span className="font-bold">{meta.totalPages}</span> ({meta.totalRecords} total users)
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={!meta.hasPreviousPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-100"
              >
                Previous
              </button>
              <button
                disabled={!meta.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Account Status Toggle */}
      <ConfirmationModal
        isOpen={isModalOpen}
        title={targetUser?.isActive ? 'Deactivate Account' : 'Activate Account'}
        message={`Are you sure you want to ${
          targetUser?.isActive ? 'deactivate' : 'activate'
        } the account for ${targetUser?.firstName} ${targetUser?.lastName} (${targetUser?.email})? ${
          targetUser?.isActive
            ? 'Deactivated users will not be able to log in to the platform.'
            : 'Activated users will regain immediate access.'
        }`}
        confirmLabel={targetUser?.isActive ? 'Deactivate User' : 'Activate User'}
        isDangerous={targetUser?.isActive}
        isLoading={isUpdatingStatus}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => {
          setIsModalOpen(false);
          setTargetUser(null);
        }}
      />
    </div>
  );
};
