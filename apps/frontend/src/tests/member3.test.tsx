import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { InvoicesListPage } from '../pages/invoices/InvoicesListPage';
import { TaxRulesConfigPage } from '../pages/taxes/TaxRulesConfigPage';
import { DiscountsConfigPage } from '../pages/discounts/DiscountsConfigPage';
import { PaymentsHistoryPage } from '../pages/payments/PaymentsHistoryPage';
import { PaymentCheckoutModal } from '../components/billing/PaymentCheckoutModal';
import { apiClient } from '../api/client';

describe('Member 3 Frontend – Invoicing & Billing Module', () => {
  it('renders InvoicesListPage with billing runner and invoice table', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        items: [
          {
            id: 'inv_test_01',
            invoiceNumber: 'INV-202610-0001',
            status: 'CONFIRMED',
            totalAmount: 1180,
            amountPaid: 0,
            currency: 'USD',
            issueDate: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            customer: {
              user: { firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
            },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <InvoicesListPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Invoices & Billing Ledger/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('INV-202610-0001')).toBeInTheDocument();
      expect(screen.getAllByText(/1180\.00/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders PaymentCheckoutModal with remaining balance and test gateway input', () => {
    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        invoice={{
          id: 'inv_123',
          invoiceNumber: 'INV-202610-0001',
          totalAmount: 500,
          amountPaid: 100,
          currency: 'USD',
        }}
      />
    );

    expect(screen.getByText('Secure Online Checkout')).toBeInTheDocument();
    expect(screen.getByText('$400.00')).toBeInTheDocument();
    expect(screen.getByText(/Razorpay \/ Mock Adapter/i)).toBeInTheDocument();
  });

  it('renders TaxRulesConfigPage with tax rules register and calculator', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 'tax_1',
            name: 'GST 18%',
            ratePercentage: 18,
            country: 'IN',
            isCompound: false,
            isActive: true,
          },
        ],
      },
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TaxRulesConfigPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Tax Configuration & Calculation Engine/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('GST 18%')).toBeInTheDocument();
      expect(screen.getByText('18.00%')).toBeInTheDocument();
    });
  });

  it('renders DiscountsConfigPage with coupon table and eligibility validator', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 'disc_1',
            code: 'SAVE20',
            type: 'PERCENTAGE',
            value: 20,
            minPurchaseAmount: 100,
            currentRedemptions: 5,
            maxRedemptions: 50,
            endDate: new Date().toISOString(),
            isActive: true,
          },
        ],
      },
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <DiscountsConfigPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Discounts & Promotional Rules/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('SAVE20')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  it('renders PaymentsHistoryPage with settlement ledger', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        items: [
          {
            id: 'pay_1',
            paymentNumber: 'PAY-202610-0001',
            invoiceId: 'inv_1',
            amount: 250,
            paymentMethod: 'BANK_WIRE',
            transactionReference: 'WIRE-998877',
            paymentDate: new Date().toISOString(),
            status: 'SUCCESS',
            invoice: { invoiceNumber: 'INV-202610-0001' },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <PaymentsHistoryPage />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Payment History & Settlement Audit Trail/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('PAY-202610-0001')).toBeInTheDocument();
      expect(screen.getByText('$250.00')).toBeInTheDocument();
      expect(screen.getByText('WIRE-998877')).toBeInTheDocument();
    });
  });
});
