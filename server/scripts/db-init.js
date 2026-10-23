// One-command database setup:
//  1. creates the first Prisma migration from schema.prisma (only if none exists)
//  2. appends prisma/constraints.sql (partial unique indexes, CHECK rules) to it
//  3. applies all migrations and generates the Prisma client
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve('prisma', 'migrations');
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

const migrationFolders = () =>
  fs.existsSync(migrationsDir)
    ? fs
        .readdirSync(migrationsDir)
        .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
        .sort()
    : [];

if (migrationFolders().length === 0) {
  console.log('\n> Creating the initial migration from prisma/schema.prisma ...');
  run('npx prisma migrate dev --name init --create-only --skip-seed');
  const folders = migrationFolders();
  const latest = folders[folders.length - 1];
  const file = path.join(migrationsDir, latest, 'migration.sql');
  const extra = fs.readFileSync(path.resolve('prisma', 'constraints.sql'), 'utf8');
  fs.appendFileSync(file, `\n-- ===== Custom constraints (from prisma/constraints.sql) =====\n${extra}`);
  console.log(`> Added custom constraints to ${path.join('prisma', 'migrations', latest, 'migration.sql')}`);
} else {
  console.log('> Migrations already exist, skipping creation.');
}

console.log('\n> Applying migrations ...');
run('npx prisma migrate deploy');
console.log('\n> Generating Prisma client ...');
run('npx prisma generate');
console.log('\nDatabase is ready. Next: npm run db:seed');
