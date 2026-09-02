import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/** Prometheus metrics (spec §116). */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpDuration: Histogram<'method' | 'route' | 'status'>;
  readonly httpErrors: Counter<'route' | 'code'>;
  readonly jobsCreated: Counter<'type'>;
  readonly dispatchOutcome: Counter<'outcome'>;
  readonly dispatchSeconds: Histogram<'type'>;
  readonly paymentFailures: Counter<'method' | 'code'>;
  readonly wsConnections: Gauge<'namespace'>;
  readonly locationUpdates: Counter<'result'>;
  readonly queueDelay: Gauge<'queue'>;
  readonly dbPool: Gauge<'state'>;
  readonly bannerEvents: Counter<'type' | 'placement'>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'tamam_' });
    this.httpDuration = new Histogram({ name: 'tamam_http_request_duration_seconds', help: 'HTTP latency', labelNames: ['method', 'route', 'status'], buckets: [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5], registers: [this.registry] });
    this.httpErrors = new Counter({ name: 'tamam_http_errors_total', help: 'HTTP 5xx/4xx by code', labelNames: ['route', 'code'], registers: [this.registry] });
    this.jobsCreated = new Counter({ name: 'tamam_jobs_created_total', help: 'Jobs created', labelNames: ['type'], registers: [this.registry] });
    this.dispatchOutcome = new Counter({ name: 'tamam_dispatch_outcome_total', help: 'Dispatch outcomes', labelNames: ['outcome'], registers: [this.registry] });
    this.dispatchSeconds = new Histogram({ name: 'tamam_dispatch_seconds', help: 'Seconds from request to assignment', labelNames: ['type'], buckets: [5, 10, 20, 30, 60, 120, 240], registers: [this.registry] });
    this.paymentFailures = new Counter({ name: 'tamam_payment_failures_total', help: 'Payment failures', labelNames: ['method', 'code'], registers: [this.registry] });
    this.wsConnections = new Gauge({ name: 'tamam_ws_connections', help: 'Open WebSocket connections', labelNames: ['namespace'], registers: [this.registry] });
    this.locationUpdates = new Counter({ name: 'tamam_location_updates_total', help: 'Location samples', labelNames: ['result'], registers: [this.registry] });
    this.queueDelay = new Gauge({ name: 'tamam_queue_oldest_waiting_seconds', help: 'Age of the oldest waiting job per queue', labelNames: ['queue'], registers: [this.registry] });
    this.dbPool = new Gauge({ name: 'tamam_db_pool', help: 'Prisma pool state', labelNames: ['state'], registers: [this.registry] });
    this.bannerEvents = new Counter({ name: 'tamam_banner_events_total', help: 'Banner impressions/clicks', labelNames: ['type', 'placement'], registers: [this.registry] });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
