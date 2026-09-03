/**
 * Test environment defaults. `envSchema` has no defaults for the security and storage values,
 * so every suite (unit and e2e) needs them present before the app is constructed.
 * Real values always win — CI and `docker-compose.test.yml` override these.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',

  JWT_ACCESS_SECRET: 'test-access-secret-must-be-at-least-32-chars!!',
  JWT_REFRESH_SECRET: 'test-refresh-secret-must-be-at-least-32-chars!',
  OTP_PEPPER: 'test-otp-pepper-must-be-at-least-32-characters',
  ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',

  DATABASE_URL: 'postgresql://tamam:tamam@localhost:5432/tamam_test',
  REDIS_URL: 'redis://localhost:6379/1',

  // Console providers keep the suite offline and make the OTP available as `devCode`.
  SMS_PROVIDER: 'console',
  PUSH_PROVIDER: 'console',
  EMAIL_PROVIDER: 'console',

  // Unreachable on purpose: routing falls back to haversine immediately instead of
  // waiting on the public OSRM demo server.
  MAPS_PROVIDER: 'osrm',
  OSRM_BASE_URL: 'http://127.0.0.1:1',
  NOMINATIM_BASE_URL: 'http://127.0.0.1:1',

  STORAGE_PROVIDER: 's3',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'tamam',
  S3_SECRET_KEY: 'tamam-secret',
  S3_BUCKET_PRIVATE: 'tamam-private',
  S3_BUCKET_PUBLIC: 'tamam-public',
  S3_PUBLIC_BASE_URL: 'http://localhost:9000/tamam-public',

  // The mock gateway signs its webhooks, so the §129 suite exercises real verification.
  PAYMENT_GATEWAY_PROVIDER: 'mock',
  PAYMENT_GATEWAY_WEBHOOK_SECRET: 'mock-webhook-secret',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] = process.env[key] ?? value;
}
