#!/usr/bin/env node
/**
 * Backup completo do Supabase (tabelas, auth.users e arquivos do Storage) — Josi Pilates
 * Uso local:  node scripts/backup.js
 * Uso CI:     variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY via env
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// ── Credenciais: process.env tem prioridade (CI), fallback para .env local ──
function loadEnv() {
  const env = { ...process.env };
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!env[key]) env[key] = val; // process.env tem prioridade
        }
      }
    });
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  console.error('   Local: defina no .env | CI: defina como GitHub Secrets.');
  process.exit(1);
}

// ── Tabelas para backup ──────────────────────────────────────────────────────
const TABLES = [
  'profiles',
  'check_ins',
  'balance_history',
  'student_class_link',
  'classes',
  'class_schedules',
  'email_notifications',
  'email_logs',
  'testimonials',
  'student_insurance',
  'practitioner_credentials',
  'insurance_receipts',
  'receipt_counters',
];

// ── Buckets do Storage (privados) para copiar ───────────────────────────────
// Cada bucket é conferido com os caminhos gravados no banco: arquivo citado
// no banco e ausente no Storage aparece como aviso no manifest.
const BUCKETS = [
  { id: 'practitioner-signatures', table: 'practitioner_credentials', column: 'signature_path' },
  { id: 'insurance-receipts',      table: 'insurance_receipts',       column: 'pdf_path' },
];

// ── HTTP (sem dependência de npm) ───────────────────────────────────────────
function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

async function fetchJson(url, headers, options = {}) {
  const { status, buffer } = await request(url, { headers, ...options });
  const text = buffer.toString('utf8');
  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status}: ${text.slice(0, 200)}`);
  }
  try { return JSON.parse(text); }
  catch { throw new Error('JSON parse error: ' + text.slice(0, 200)); }
}

async function fetchTable(table) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'count=exact',
  };
  let all = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${from}`;
    const data = await fetchJson(url, headers);
    if (!Array.isArray(data)) {
      throw new Error(`Tabela ${table} retornou: ${JSON.stringify(data).slice(0, 200)}`);
    }
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ── Auth users (admin API) ───────────────────────────────────────────────────
async function fetchAuthUsers() {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
  const data = await fetchJson(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, headers);
  return data.users || [];
}

// ── Storage: lista recursiva e download ─────────────────────────────────────
const storageHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
});

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

// A API de listagem não é recursiva: pastas vêm com id null.
async function listBucket(bucket, prefix = '') {
  const files = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const page = await fetchJson(
      `${SUPABASE_URL}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      { ...storageHeaders(), 'Content-Type': 'application/json' },
      {
        method: 'POST',
        body: JSON.stringify({ prefix, limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } }),
      },
    );
    if (!Array.isArray(page)) {
      throw new Error(`Listagem de ${bucket}/${prefix} retornou: ${JSON.stringify(page).slice(0, 200)}`);
    }
    for (const item of page) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...await listBucket(bucket, full));
      else files.push(full);
    }
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return files;
}

async function downloadObject(bucket, objectPath) {
  const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(objectPath)}`;
  const { status, buffer } = await request(url, { headers: storageHeaders() });
  if (status !== 200) {
    throw new Error(`HTTP ${status}: ${buffer.toString('utf8').slice(0, 200)}`);
  }
  return buffer;
}

// Garante que o nome vindo do Storage não escape da pasta do backup.
function safeTarget(baseDir, objectPath) {
  const target = path.resolve(baseDir, objectPath);
  if (!target.startsWith(baseDir + path.sep)) {
    throw new Error(`caminho inválido no Storage: ${objectPath}`);
  }
  return target;
}

async function backupBucket(outDir, { id, table, column }) {
  const baseDir = path.resolve(outDir, 'storage', id);
  fs.mkdirSync(baseDir, { recursive: true });

  const files = await listBucket(id);
  let bytes = 0;
  const failed = [];
  for (const objectPath of files) {
    try {
      const target = safeTarget(baseDir, objectPath);
      const data = await downloadObject(id, objectPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
      bytes += data.length;
    } catch (err) {
      failed.push({ path: objectPath, error: err.message });
    }
  }

  // Conferência com o banco: arquivos citados nas tabelas e ausentes no Storage
  const tableFile = path.join(outDir, `${table}.json`);
  let missing = [];
  if (fs.existsSync(tableFile)) {
    const found = new Set(files);
    const rows = JSON.parse(fs.readFileSync(tableFile, 'utf8'));
    missing = rows.map(r => r[column]).filter(p => p && !found.has(p));
  }

  return { count: files.length - failed.length, bytes, failed, missingFromStorage: missing };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function runBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.resolve('backups', ts);
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = { timestamp: new Date().toISOString(), tables: {}, auth: {}, storage: {} };
  let totalRows = 0;
  let errors = 0;

  // Tabelas do banco
  for (const table of TABLES) {
    process.stdout.write(`  → ${table.padEnd(32)}`);
    try {
      const rows = await fetchTable(table);
      fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2), 'utf8');
      manifest.tables[table] = { count: rows.length };
      totalRows += rows.length;
      console.log(`✓ ${rows.length} registros`);
    } catch (err) {
      console.log(`✗ ERRO: ${err.message}`);
      manifest.tables[table] = { error: err.message };
      errors++;
    }
  }

  // Auth users (contém emails, nomes, metadados)
  process.stdout.write(`  → ${'auth.users'.padEnd(32)}`);
  try {
    const users = await fetchAuthUsers();
    fs.writeFileSync(path.join(outDir, 'auth_users.json'), JSON.stringify(users, null, 2), 'utf8');
    manifest.auth = { count: users.length };
    totalRows += users.length;
    console.log(`✓ ${users.length} registros`);
  } catch (err) {
    console.log(`✗ ERRO: ${err.message}`);
    manifest.auth = { error: err.message };
    errors++;
  }

  // Arquivos do Storage (assinatura e PDFs dos recibos)
  let totalFiles = 0;
  let warnings = 0;
  for (const bucket of BUCKETS) {
    process.stdout.write(`  → ${('storage/' + bucket.id).padEnd(32)}`);
    try {
      const result = await backupBucket(outDir, bucket);
      manifest.storage[bucket.id] = result;
      totalFiles += result.count;
      if (result.failed.length > 0) {
        errors++;
        console.log(`✗ ${result.count} arquivo(s), ${result.failed.length} com ERRO`);
        result.failed.forEach(f => console.log(`      ${f.path}: ${f.error}`));
      } else {
        console.log(`✓ ${result.count} arquivo(s) (${Math.round(result.bytes / 1024)} KB)`);
      }
      if (result.missingFromStorage.length > 0) {
        warnings++;
        console.log(`      ⚠️  ${result.missingFromStorage.length} arquivo(s) citado(s) em ${bucket.table}.${bucket.column} não existem no Storage:`);
        result.missingFromStorage.forEach(p => console.log(`      ${p}`));
      }
    } catch (err) {
      console.log(`✗ ERRO: ${err.message}`);
      manifest.storage[bucket.id] = { error: err.message };
      errors++;
    }
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('');
  console.log(`📦 Backup salvo em: ${outDir}`);
  console.log(`   Total de registros: ${totalRows}`);
  console.log(`   Arquivos do Storage: ${totalFiles}`);
  if (warnings > 0) {
    console.log(`   ⚠️  ${warnings} bucket(s) com arquivo citado no banco e ausente no Storage (ver manifest.json)`);
  }
  if (errors > 0) {
    console.log(`   ⚠️  ${errors} item(ns) com erro`);
    process.exit(1);
  }
  console.log('   ✅ Backup completo sem erros.');
}

console.log('🗄️  Iniciando backup — Josi Pilates');
console.log(`   Supabase: ${SUPABASE_URL}`);
console.log('');
runBackup().catch(err => {
  console.error('❌ Backup falhou:', err.message);
  process.exit(1);
});
