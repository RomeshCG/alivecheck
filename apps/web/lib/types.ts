export type User = {
  id: string;
  email: string;
  createdAt: string;
};

export type MonitorStatus = 'NEW' | 'UP' | 'DOWN' | 'RECOVERED';

export type Monitor = {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'HEAD';
  intervalSeconds: number;
  timeoutSeconds: number;
  expectedStatus: number;
  failureThreshold: number;
  recoveryThreshold: number;
  enabled: boolean;
  currentStatus: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  notifications?: {
    id: string;
    enabled: boolean;
    provider: { id: string; name: string; type: 'SMTP' | 'WEBHOOK'; enabled: boolean };
  }[];
};

export type MonitorCheck = {
  id: string;
  checkedAt: string;
  success: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorType: string | null;
};

export type Incident = {
  id: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMs: number | null;
  errorSummary: string | null;
};

export type Provider = {
  id: string;
  type: 'SMTP' | 'WEBHOOK';
  name: string;
  enabled: boolean;
  createdAt: string;
  config: Record<string, unknown>;
};
