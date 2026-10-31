import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const rules = [
    { label: 'More than 8 characters', valid: password.length > 8 },
    { label: 'At least one uppercase letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter (a-z)', valid: /[a-z]/.test(password) },
    { label: 'At least one number (0-9)', valid: /\d/.test(password) },
    { label: 'At least one special character (@$!%*?& etc.)', valid: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
      <div className="font-semibold text-slate-700 mb-1">Password Requirements:</div>
      {rules.map((rule, idx) => (
        <div key={idx} className="flex items-center space-x-2">
          {rule.valid ? (
            <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center flex-shrink-0">
              <X className="w-3 h-3 stroke-[2]" />
            </div>
          )}
          <span className={rule.valid ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
            {rule.label}
          </span>
        </div>
      ))}
    </div>
  );
};
