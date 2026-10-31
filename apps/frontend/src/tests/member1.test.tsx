import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PasswordStrengthIndicator } from '../components/common/PasswordStrengthIndicator';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AuthProvider } from '../context/AuthContext';

describe('Member 1 Frontend – Password Strength Indicator', () => {
  it('correctly marks password rules as invalid on weak input', () => {
    render(<PasswordStrengthIndicator password="short" />);
    expect(screen.getByText('More than 8 characters')).toHaveClass('text-slate-500');
    expect(screen.getByText('At least one uppercase letter (A-Z)')).toHaveClass('text-slate-500');
    expect(screen.getByText('At least one special character (@$!%*?& etc.)')).toHaveClass(
      'text-slate-500'
    );
  });

  it('marks all rules as valid when strict password is provided', () => {
    render(<PasswordStrengthIndicator password="ValidPassword@123" />);
    expect(screen.getByText('More than 8 characters')).toHaveClass('text-emerald-700');
    expect(screen.getByText('At least one uppercase letter (A-Z)')).toHaveClass('text-emerald-700');
    expect(screen.getByText('At least one lowercase letter (a-z)')).toHaveClass('text-emerald-700');
    expect(screen.getByText('At least one number (0-9)')).toHaveClass('text-emerald-700');
    expect(screen.getByText('At least one special character (@$!%*?& etc.)')).toHaveClass(
      'text-emerald-700'
    );
  });
});

describe('Member 1 Frontend – Confirmation Modal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConfirmationModal
        isOpen={false}
        title="Test Modal"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal and triggers callbacks on click', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        title="Confirm Plan Deactivation"
        message="Are you sure you want to deactivate this plan?"
        confirmLabel="Yes, Deactivate"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Confirm Plan Deactivation')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to deactivate this plan/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Yes, Deactivate'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Member 1 Frontend – Authentication Pages Render', () => {
  it('renders Login page with quick-fill demo buttons and credentials inputs', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Sign in to OdooSub')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();

    // Quick fill admin
    fireEvent.click(screen.getByText('Admin'));
    expect((screen.getByPlaceholderText('name@company.com') as HTMLInputElement).value).toBe(
      'admin@odoo.local'
    );
  });

  it('renders Register page with password complexity checklist and billing address fields', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <RegisterPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Create Customer Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Sarah')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Connor')).toBeInTheDocument();
    expect(screen.getByText('Password Requirements:')).toBeInTheDocument();
    expect(screen.getByText('Organization & Billing Address')).toBeInTheDocument();
  });

  it('renders Forgot Password page with email input', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ForgotPasswordPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Forgot Password')).toBeInTheDocument();
    expect(screen.getByText('Send Password Reset Link')).toBeInTheDocument();
  });

  it('renders Reset Password page with token and password fields', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ResetPasswordPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Set New Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste 64-character token')).toBeInTheDocument();
  });
});
