import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function restoreDatabase(backupFileName: string) {
  try {
    console.log('[Restore] Starting database restore...');

    const backupFile = path.join(BACKUP_DIR, backupFileName);

    // Check if backup file exists
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    console.log(`[Restore] Restoring from: ${backupFile}`);
    console.warn('[Restore] ⚠️  This will replace all current data!');

    // Run psql to restore backup
    const { stdout, stderr } = await execAsync(
      `psql "${databaseUrl}" < "${backupFile}"`
    );

    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('[Restore] Warning:', stderr);
    }

    console.log('[Restore] ✓ Database restored successfully');
    return true;
  } catch (error) {
    console.error('[Restore] Error during restore:', error);
    throw error;
  }
}

function listBackups() {
  console.log('[Restore] Available backups:');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('  No backups found (backup directory does not exist)');
    return [];
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      size: fs.statSync(path.join(BACKUP_DIR, f)).size,
      modified: fs.statSync(path.join(BACKUP_DIR, f)).mtime
    }))
    .sort((a, b) => b.modified.getTime() - a.modified.getTime());

  if (files.length === 0) {
    console.log('  No backups found');
  } else {
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name}`);
      console.log(`     Size: ${(file.size / 1024).toFixed(2)} KB`);
      console.log(`     Date: ${file.modified.toLocaleString()}`);
    });
  }

  return files;
}

// Run if executed directly (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.log('Usage: npx tsx scripts/restore-database.ts <backup-filename>');
    console.log('\nAvailable backups:');
    listBackups();
    process.exit(1);
  }

  restoreDatabase(backupFile)
    .then(() => {
      console.log('[Restore] Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Restore] Script failed:', error);
      process.exit(1);
    });
}

export { restoreDatabase, listBackups };
