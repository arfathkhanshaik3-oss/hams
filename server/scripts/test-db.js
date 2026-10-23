// Prepares the TEST database: loads .env.test and applies all migrations to it.
//   npm run test:db
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

const result = dotenv.config({ path: '.env.test' });
if (result.error || !process.env.DATABASE_URL) {
  console.error('\nCould not read server/.env.test. Copy .env.test.example to .env.test and set your password first.\n');
  process.exit(1);
}
const dbName = new URL(process.env.DATABASE_URL).pathname.replace('/', '');
if (!/test/i.test(dbName)) {
  console.error(`\nRefusing to continue: the test database name must contain "test" (got "${dbName}").\nTests DELETE all data in it.\n`);
  process.exit(1);
}
console.log(`> Applying migrations to test database "${dbName}" ...`);
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
console.log('\nTest database is ready. Run: npm test');
