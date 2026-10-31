import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
        <p>© 2026 Subscription Operations & Billing Platform. Four-Member Engineering Capstone.</p>
        <div className="flex space-x-6 mt-3 sm:mt-0 font-medium">
          <span>Member 1: Identity & Catalog</span>
          <span>Member 2: Subscriptions & Pricing</span>
          <span>Member 3: Invoicing & Payments</span>
          <span>Member 4: Analytics & Operations</span>
        </div>
      </div>
    </footer>
  );
};
