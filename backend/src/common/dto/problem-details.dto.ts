export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code?: string;
  invalidParams?: Array<{
    name: string;
    reason: string;
  }>;
  timestamp: string;
  traceId?: string;
}
