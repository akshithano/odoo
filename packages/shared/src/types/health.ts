export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  status: HealthStatus;
  responseTimeMs?: number;
  message?: string;
  error?: string;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  services: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queue: ComponentHealth;
  };
}
