/**
 * Centralised TanStack Query keys. Every key is an array whose first element is the domain, so
 * `invalidateQueries({ queryKey: queryKeys.jobs.all })` refreshes every job-related query.
 */
type Filters = Record<string, unknown> | undefined;

export const queryKeys = {
  session: { me: ['session', 'me'] as const },
  overview: ['overview'] as const,
  dashboard: ['dashboard'] as const,
  kpis: (filters: Filters) => ['kpis', filters] as const,
  reports: (filters: Filters) => ['reports', filters] as const,
  search: (q: string) => ['search', q] as const,
  liveMap: (filters: Filters) => ['live-map', filters] as const,
  dispatch: {
    all: ['dispatch'] as const,
    console: (filters: Filters) => ['dispatch', 'console', filters] as const,
    nearby: (filters: Filters) => ['dispatch', 'nearby', filters] as const,
    partnerTimeline: (id: string) => ['dispatch', 'partner-timeline', id] as const,
    assignments: (jobId: string) => ['dispatch', 'assignments', jobId] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    list: (filters: Filters) => ['jobs', 'list', filters] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
    timeline: (id: string) => ['jobs', 'timeline', id] as const,
    chat: (id: string) => ['jobs', 'chat', id] as const,
    sos: ['jobs', 'sos'] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (filters: Filters) => ['customers', 'list', filters] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
    reviews: (id: string) => ['customers', 'reviews', id] as const,
  },
  partners: {
    all: ['partners'] as const,
    list: (filters: Filters) => ['partners', 'list', filters] as const,
    detail: (id: string) => ['partners', 'detail', id] as const,
    vehicles: (filters: Filters) => ['partners', 'vehicles', filters] as const,
    vehicle: (id: string) => ['partners', 'vehicle', id] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    serviceTypes: ['catalog', 'service-types'] as const,
    categories: ['catalog', 'categories'] as const,
    vehicleTypes: ['catalog', 'vehicle-types'] as const,
    packageCategories: ['catalog', 'package-categories'] as const,
  },
  zones: {
    all: ['zones'] as const,
    list: ['zones', 'list'] as const,
    detail: (id: string) => ['zones', 'detail', id] as const,
    rules: (id: string) => ['zones', 'rules', id] as const,
  },
  pricing: {
    all: ['pricing'] as const,
    rules: (filters: Filters) => ['pricing', 'rules', filters] as const,
    surge: (filters: Filters) => ['pricing', 'surge', filters] as const,
    cancellation: ['pricing', 'cancellation'] as const,
  },
  promotions: {
    all: ['promotions'] as const,
    list: (filters: Filters) => ['promotions', 'list', filters] as const,
    stats: (id: string) => ['promotions', 'stats', id] as const,
    referralProgram: ['promotions', 'referral-program'] as const,
    referralRewards: (filters: Filters) => ['promotions', 'referral-rewards', filters] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
    list: (filters: Filters) => ['campaigns', 'list', filters] as const,
    detail: (id: string) => ['campaigns', 'detail', id] as const,
    stats: (id: string, filters: Filters) => ['campaigns', 'stats', id, filters] as const,
    preview: (filters: Filters) => ['campaigns', 'preview', filters] as const,
  },
  finance: {
    all: ['finance'] as const,
    accounts: (filters: Filters) => ['finance', 'accounts', filters] as const,
    transactions: (filters: Filters) => ['finance', 'transactions', filters] as const,
    statement: (walletId: string) => ['finance', 'statement', walletId] as const,
    payments: (filters: Filters) => ['finance', 'payments', filters] as const,
    payment: (id: string) => ['finance', 'payment', id] as const,
    refunds: (filters: Filters) => ['finance', 'refunds', filters] as const,
    withdrawals: (filters: Filters) => ['finance', 'withdrawals', filters] as const,
    commission: ['finance', 'commission'] as const,
  },
  support: {
    all: ['support'] as const,
    tickets: (filters: Filters) => ['support', 'tickets', filters] as const,
    ticket: (id: string) => ['support', 'ticket', id] as const,
    reports: (filters: Filters) => ['support', 'reports', filters] as const,
  },
  disputes: {
    all: ['disputes'] as const,
    list: (filters: Filters) => ['disputes', 'list', filters] as const,
    detail: (id: string) => ['disputes', 'detail', id] as const,
  },
  risk: {
    all: ['risk'] as const,
    signals: (filters: Filters) => ['risk', 'signals', filters] as const,
    restrictions: (filters: Filters) => ['risk', 'restrictions', filters] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    templates: ['notifications', 'templates'] as const,
  },
  config: {
    all: ['config'] as const,
    list: ['config', 'list'] as const,
    flags: ['config', 'flags'] as const,
    queues: ['config', 'queues'] as const,
  },
  staff: {
    all: ['staff'] as const,
    list: (filters: Filters) => ['staff', 'list', filters] as const,
    detail: (id: string) => ['staff', 'detail', id] as const,
    roles: ['staff', 'roles'] as const,
    permissions: ['staff', 'permissions'] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (filters: Filters) => ['audit', 'list', filters] as const,
  },
  account: { sessions: ['account', 'sessions'] as const },
} as const;
