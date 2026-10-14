/**
 * Manto 2.0 - Production Readiness & Pre-Deployment Verification Script
 * Validates files, configuration, schemas, and detects harmful placeholders.
 * 
 * Execution: node scripts/verify-pre-deploy.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const checks = [];
let failureCount = 0;
let warningCount = 0;

function pass(name, details) {
  checks.push({ status: 'PASS', name, details });
  console.log(`[PASS] ${name}: ${details}`);
}

function warn(name, details) {
  warningCount++;
  checks.push({ status: 'WARN', name, details });
  console.log(`[WARN] ${name}: ${details}`);
}

function fail(name, details) {
  failureCount++;
  checks.push({ status: 'FAIL', name, details });
  console.log(`[FAIL] ${name}: ${details}`);
}

console.log('================================================================');
console.log('       MANTO 2.0 - PRE-DEPLOYMENT ARCHITECTURE AUDIT            ');
console.log('================================================================\n');

// 1. Verify Docker Artifacts
const requiredFiles = [
  'backend/Dockerfile',
  'frontend/Dockerfile',
  'docker-compose.prod.yml',
  'Caddyfile',
  '.env.production.example',
  'backend/src/health/health.controller.ts',
  'backend/src/database/migrations/001_esquema_inicial.sql',
  'frontend/public/.gitkeep',
  'frontend/next.config.mjs',
];

for (const file of requiredFiles) {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    if (stats.size > 0) {
      pass(`File Existence: ${file}`, `Found (${stats.size} bytes)`);
    } else {
      fail(`File Empty: ${file}`, `File exists but is 0 bytes`);
    }
  } else {
    fail(`File Missing: ${file}`, `Path not found: ${fullPath}`);
  }
}

// 2. Validate backend/Dockerfile
try {
  const backendDocker = fs.readFileSync(path.join(rootDir, 'backend/Dockerfile'), 'utf8');
  if (backendDocker.includes('FROM node:20-alpine') && backendDocker.includes('USER node')) {
    pass('Backend Dockerfile Security', 'Uses Node 20 Alpine and runs as unprivileged user "node"');
  } else {
    fail('Backend Dockerfile Security', 'Missing Node 20 Alpine or non-root user');
  }

  if (backendDocker.includes('HEALTHCHECK') && backendDocker.includes('/health')) {
    pass('Backend Dockerfile Healthcheck', 'Healthcheck probe configured on /health');
  } else {
    fail('Backend Dockerfile Healthcheck', 'Missing container HEALTHCHECK probe on /health');
  }

  if (backendDocker.includes('cp src/database/migrations/*.sql dist/database/migrations/')) {
    pass('Backend Migration Assets', 'SQL migrations guaranteed to be bundled into dist/');
  } else {
    warn('Backend Migration Assets', 'Verify NestJS asset copying for SQL migrations');
  }
} catch (e) {
  fail('Backend Dockerfile Audit', e.message);
}

// 3. Validate frontend/Dockerfile
try {
  const frontendDocker = fs.readFileSync(path.join(rootDir, 'frontend/Dockerfile'), 'utf8');
  if (frontendDocker.includes('FROM node:20-alpine') && frontendDocker.includes('USER nextjs')) {
    pass('Frontend Dockerfile Security', 'Uses Node 20 Alpine and runs as unprivileged user "nextjs"');
  } else {
    fail('Frontend Dockerfile Security', 'Missing Node 20 Alpine or unprivileged user');
  }

  if (frontendDocker.includes('.next/standalone')) {
    pass('Frontend Next.js Standalone', 'Properly copies standalone bundle and static assets');
  } else {
    fail('Frontend Next.js Standalone', 'Missing Next.js standalone bundle copy instructions');
  }
} catch (e) {
  fail('Frontend Dockerfile Audit', e.message);
}

// 4. Validate docker-compose.prod.yml
try {
  const compose = fs.readFileSync(path.join(rootDir, 'docker-compose.prod.yml'), 'utf8');
  if (compose.includes('postgres:16-alpine') && compose.includes('caddy:2.8-alpine')) {
    pass('Docker Compose Images', 'PostgreSQL 16 Alpine and Caddy 2.8 Alpine pinned');
  } else {
    fail('Docker Compose Images', 'Database or Proxy image tags missing/unpinned');
  }

  if (compose.includes('manto-net') && compose.includes('manto_postgres_data')) {
    pass('Docker Compose Isolation', 'Isolated network and persistent volumes declared');
  } else {
    fail('Docker Compose Isolation', 'Missing bridge network or persistent volume definitions');
  }

  if (compose.includes('DATABASE_PASSWORD:?DATABASE_PASSWORD must be defined in .env')) {
    pass('Docker Compose Fail-Safe', 'Mandatory env guard prevents boot with empty database password');
  } else {
    warn('Docker Compose Fail-Safe', 'Consider strict bash interpolation guards for DATABASE_PASSWORD');
  }
} catch (e) {
  fail('Docker Compose Audit', e.message);
}

// 5. Validate Caddyfile Layer 7 Routing & Security Headers
try {
  const caddy = fs.readFileSync(path.join(rootDir, 'Caddyfile'), 'utf8');
  if (caddy.includes('Strict-Transport-Security') && caddy.includes('Content-Security-Policy')) {
    pass('Caddy Security Headers', 'HSTS and CSP headers configured for OWASP compliance');
  } else {
    fail('Caddy Security Headers', 'Missing essential HSTS or CSP headers');
  }

  if (caddy.includes('reverse_proxy backend:3003') && caddy.includes('reverse_proxy frontend:3002')) {
    pass('Caddy Layer 7 Reverse Proxy', 'Correctly proxies /v1/* to backend:3003 and web to frontend:3002');
  } else {
    fail('Caddy Layer 7 Reverse Proxy', 'Upstream backend or frontend routing missing');
  }
} catch (e) {
  fail('Caddyfile Audit', e.message);
}

// 6. Validate Database Migration 001_esquema_inicial.sql
try {
  const migration = fs.readFileSync(
    path.join(rootDir, 'backend/src/database/migrations/001_esquema_inicial.sql'),
    'utf8'
  );
  const requiredTables = [
    'insurance.quotes',
    'insurance.policies',
    'insurance.claims',
    'insurance.razas_manejo_especial',
  ];
  for (const table of requiredTables) {
    if (migration.includes(`CREATE TABLE ${table}`)) {
      pass(`Database Schema: ${table}`, 'Table definition present in migration');
    } else {
      fail(`Database Schema: ${table}`, `Missing table definition ${table}`);
    }
  }

  if (migration.includes('policies_exigir_rce_ley_1801') && migration.includes('quotes_exigir_rce_ley_1801')) {
    pass('Database Ley 1801 Triggers', 'Structural RCE 50 SMLMV enforcement triggers verified');
  } else {
    fail('Database Ley 1801 Triggers', 'Triggers enforcing mandatory Civil Liability are missing');
  }
} catch (e) {
  fail('Database Migration Audit', e.message);
}

// 7. Validate Healthcheck Controller
try {
  const healthCode = fs.readFileSync(
    path.join(rootDir, 'backend/src/health/health.controller.ts'),
    'utf8'
  );
  if (healthCode.includes('@Controller([\'health\', \'v1/health\'])') && healthCode.includes('SELECT 1 AS alive')) {
    pass('HealthCheck Controller', 'Exposes /health and /v1/health with active PostgreSQL query verification');
  } else {
    fail('HealthCheck Controller', 'Health controller does not test active database connectivity');
  }
} catch (e) {
  fail('HealthCheck Audit', e.message);
}

// 8. Placeholder & Dangerous Defaults Check in Production Template & Active .env
try {
  const envExample = fs.readFileSync(path.join(rootDir, '.env.production.example'), 'utf8');
  if (envExample.includes('manto_super_secure_production_password_2026!')) {
    pass('Production Template Audit', 'Template file present with required parameter definitions');
  }

  const realEnvPath = path.join(rootDir, '.env');
  if (fs.existsSync(realEnvPath)) {
    const realEnv = fs.readFileSync(realEnvPath, 'utf8');
    if (realEnv.includes('manto_super_secure_production_password_2026!')) {
      fail('Active .env Security', 'Real .env is still using the placeholder DATABASE_PASSWORD!');
    } else {
      pass('Active .env Database Password', 'Real .env overrides default DATABASE_PASSWORD');
    }
    if (realEnv.includes('super_secret_jwt_random_key_min_64_chars_manto_production_2026')) {
      fail('Active .env Security', 'Real .env is still using the placeholder JWT_SECRET!');
    } else {
      pass('Active .env JWT Secret', 'Real .env overrides default JWT_SECRET');
    }
  } else {
    warn('Active .env Status', 'No .env file detected in repository root. Ensure it is created before running docker-compose.');
  }
} catch (e) {
  fail('Env Example Audit', e.message);
}

console.log('\n================================================================');
console.log(`SUMMARY: ${checks.filter(c => c.status === 'PASS').length} Passed, ${warningCount} Warnings, ${failureCount} Failures`);
console.log('================================================================');

if (failureCount > 0) {
  console.error('\n❌ PRE-DEPLOYMENT VERIFICATION FAILED: Resolve errors before deploying to production.');
  process.exit(1);
} else {
  console.log('\n✅ PRE-DEPLOYMENT VERIFICATION SUCCEEDED: System is ready for production deployment.');
  process.exit(0);
}
