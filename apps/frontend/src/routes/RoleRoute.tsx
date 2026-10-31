import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '@odoo/shared';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-xl border border-rose-200 shadow-sm text-center">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600 mb-6">
          Your current account role (<span className="font-semibold">{user?.role || 'GUEST'}</span>) does not have permission to view or manage this resource. Required role(s):{' '}
          <span className="font-semibold text-slate-800">{allowedRoles.join(', ')}</span>.
        </p>
        <Link
          to="/"
          className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Platform Overview
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
