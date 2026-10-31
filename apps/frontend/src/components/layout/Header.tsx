import React from 'react';
import { Layers, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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

        <div className="flex items-center space-x-4">
          <div className="flex items-center text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-md">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
            RBAC Enabled Monorepo
          </div>
        </div>
      </div>
    </header>
  );
};
