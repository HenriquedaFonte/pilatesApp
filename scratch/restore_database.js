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

const backupDir = process.argv[2];
if (!backupDir) {
  console.error("Usage: node scratch/restore_database.js <backup_directory_path>");
  process.exit(1);
}

const manifestPath = path.join(backupDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`Error: Manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log(`Starting database restore from: ${backupDir}`);
console.log(`Backup Timestamp: ${manifest.timestamp}`);

async function restoreTable(table, fileName) {
  const filePath = path.join(backupDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`File for table ${table} not found at ${filePath}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (data.length === 0) {
    console.log(`Table ${table} is empty in backup. Skipping.`);
    return;
  }

  console.log(`Restoring ${data.length} rows to table ${table}...`);
  
  // Upsert in chunks of 200 to avoid request body size limits
  const chunkSize = 200;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: table === 'student_class_link' ? 'student_id,class_schedule_id' : 'id' });

    if (error) {
      throw new Error(`Failed to restore chunk for ${table}: ${error.message}`);
    }
  }
  console.log(`✓ Restored ${table} successfully`);
}

async function runRestore() {
  const orderedTables = [
    'classes',
    'profiles',
    'class_schedules',
    'student_class_link',
    'check_ins',
    'balance_history',
    'email_notifications',
    'testimonials',
    'email_logs'
  ];

  for (const table of orderedTables) {
    if (manifest.tables[table]) {
      try {
        await restoreTable(table, manifest.tables[table].file);
      } catch (err) {
        console.error(`✗ Error restoring table ${table}:`, err.message);
      }
    }
  }
  console.log('\nRestore process completed.');
}

runRestore().catch(err => {
  console.error("Restore failed:", err);
  process.exit(1);
});
