export enum SubscriptionStatus {
  DRAFT = 'DRAFT',
  QUOTATION = 'QUOTATION',
  CONFIRMED = 'CONFIRMED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  CLOSED = 'CLOSED',
}

export enum BillingFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum PricingModel {
  FLAT = 'FLAT',
  GRADUATED = 'GRADUATED',
  VOLUME = 'VOLUME',
  USAGE_BASED = 'USAGE_BASED',
}
