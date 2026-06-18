#!/usr/bin/env node
/**
 * Backup completo do banco Supabase — Josi Pilates
 * Uso local:  node scripts/backup.js
 * Uso CI:     variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY via env
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { createRequire } from 'module';

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
];

// ── Fetch com paginação (sem dependência de npm) ─────────────────────────────
function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
  });
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

// ── Main ─────────────────────────────────────────────────────────────────────
async function runBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.resolve('backups', ts);
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = { timestamp: new Date().toISOString(), tables: {}, auth: {} };
  let totalRows = 0;
  let errors = 0;

  // Tabelas do banco
  for (const table of TABLES) {
    process.stdout.write(`  → ${table.padEnd(22)}`);
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
  process.stdout.write(`  → ${'auth.users'.padEnd(22)}`);
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

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('');
  console.log(`📦 Backup salvo em: ${outDir}`);
  console.log(`   Total de registros: ${totalRows}`);
  if (errors > 0) {
    console.log(`   ⚠️  ${errors} tabela(s) com erro`);
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
