'use strict';

exports.config = {
  agent_enabled: process.env.NEW_RELIC_ENABLED === 'true',
  app_name: [process.env.NEW_RELIC_APP_NAME ?? 'autoflow-saga'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY ?? '',
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout',
  },
  allow_all_headers: true,
  distributed_tracing: { enabled: true },
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated',
    explain_threshold: 500,
  },
  error_collector: { enabled: true, ignore_status_codes: [404] },
  attributes: { enabled: true, include: ['request.headers.*', 'response.headers.*'] },
  application_logging: {
    enabled: true,
    forwarding: { enabled: true },
    local_decorating: { enabled: false },
  },
};
