import dotenv from 'dotenv';

// Tests read .env.test, everything else reads .env
dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\nMissing required environment variable(s): ${missing.join(', ')}`);
  console.error('Copy server/.env.example to server/.env and fill it in.\n');
  process.exit(1);
}
if (isProd && (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('replace-me'))) {
  console.error('JWT_SECRET must be a long random string in production.');
  process.exit(1);
}

export const env = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProd,
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  rateLimitDisabled: process.env.RATE_LIMIT_DISABLED === 'true',
  enableJobs: process.env.ENABLE_JOBS !== 'false' && nodeEnv !== 'test',
};
