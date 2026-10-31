import React from 'react';
import { Layers, ShieldCheck, LogOut, PlusCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '@odoo/shared';

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleBadgeColor: Record<string, string> = {
    [UserRole.ADMIN]: 'bg-purple-100 text-purple-700 border-purple-200',
    [UserRole.STAFF]: 'bg-blue-100 text-blue-700 border-blue-200',
    [UserRole.CUSTOMER]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">OdooSub</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                Foundation v1.0
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 text-sm font-medium text-slate-600">
            <Link
              to="/products"
              className="px-3 py-2 rounded-lg hover:text-indigo-600 hover:bg-slate-50 transition-colors"
            >
              Products
            </Link>
            <Link
              to="/plans"
              className="px-3 py-2 rounded-lg hover:text-indigo-600 hover:bg-slate-50 transition-colors"
            >
              Plans
            </Link>
            {isAuthenticated && (user?.role === UserRole.ADMIN || user?.role === UserRole.STAFF) && (
              <Link
                to="/users"
                className="px-3 py-2 rounded-lg hover:text-indigo-600 hover:bg-slate-50 transition-colors"
              >
                Users
              </Link>
            )}
            {isAuthenticated && user?.role === UserRole.ADMIN && (
              <Link
                to="/users/staff/create"
                className="px-3 py-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Provision Staff
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden lg:flex items-center text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-md">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
            RBAC Enabled Monorepo
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              <Link
                to={`/users/${user.id}`}
                className="flex items-center space-x-2 text-sm text-slate-700 hover:text-indigo-600 py-1 px-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <span className="hidden sm:inline font-medium">
                  {user.firstName} {user.lastName}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    roleBadgeColor[user.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {user.role}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
