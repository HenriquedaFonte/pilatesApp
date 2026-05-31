import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Setup paths
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found at " + envPath);
  process.exit(1);
}

// Parse .env manually
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = value;
    }
  }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

const tables = [
  'profiles',
  'student_class_link',
  'class_schedules',
  'classes',
  'check_ins',
  'balance_history',
  'email_notifications',
  'testimonials',
  'email_logs',
  'enrollments'
];

const backupDir = process.argv[2] || path.resolve('backups');

console.log(`Starting database backup to: ${backupDir}`);
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function fetchAllRows(table) {
  let allData = [];
  let from = 0;
  let to = 999;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, to);

    if (error) {
      // Fallback to select without range if it's a small table or has specific constraints
      const { data: allRows, error: allErr } = await supabase.from(table).select('*');
      if (allErr) {
        throw new Error(`Failed to fetch table ${table}: ${allErr.message}`);
      }
      return allRows;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData.push(...data);
      if (data.length < 1000) {
        hasMore = false;
      } else {
        from += 1000;
        to += 1000;
      }
    }
  }
  return allData;
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifest = {
    timestamp,
    tables: {}
  };

  for (const table of tables) {
    try {
      console.log(`Backing up table: ${table}...`);
      const data = await fetchAllRows(table);
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      manifest.tables[table] = {
        count: data.length,
        file: `${table}.json`
      };
      console.log(`✓ Backed up ${data.length} rows for ${table}`);
    } catch (err) {
      console.error(`✗ Error backing up table ${table}:`, err.message);
    }
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nBackup completed successfully! Manifest written to ${manifestPath}`);
}

runBackup().catch(err => {
  console.error("Backup failed:", err);
  process.exit(1);
});
