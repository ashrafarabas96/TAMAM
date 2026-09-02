process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-must-be-at-least-32-chars!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-must-be-at-least-32-chars!';
process.env.OTP_PEPPER = process.env.OTP_PEPPER ?? 'test-otp-pepper-must-be-at-least-32-characters';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://tamam:tamam@localhost:5432/tamam_test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379/1';
