import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

describe('App Root Component', () => {
  it('renders the header and platform title', () => {
    render(<App />);
    expect(screen.getByText('OdooSub')).toBeInTheDocument();
    expect(screen.getByText(/Subscription Management & Billing System/i)).toBeInTheDocument();
  });

  it('renders the 4-member architecture cards and footer tags', () => {
    render(<App />);
    expect(screen.getAllByText(/Member 1: Identity & Catalog/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Member 2: Subscriptions & Pricing/i).length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText(/Member 3: Invoicing & Payments/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Member 4: Analytics & Operations/i).length).toBeGreaterThanOrEqual(
      1
    );
  });
});
