import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7;

async function backupDatabase() {
  try {
    console.log('[Backup] Starting database backup...');

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('[Backup] Created backup directory');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    console.log(`[Backup] Backing up to: ${backupFile}`);

    const { stdout, stderr } = await execAsync(
      `pg_dump "${databaseUrl}" > "${backupFile}"`
    );

    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('[Backup] Warning:', stderr);
    }

    if (fs.existsSync(backupFile)) {
      const stats = fs.statSync(backupFile);
      console.log(`[Backup] ✓ Backup created successfully (${(stats.size / 1024).toFixed(2)} KB)`);

      cleanupOldBackups();
    } else {
      throw new Error('Backup file was not created');
    }

    console.log('[Backup] Backup completed successfully');
    return backupFile;
  } catch (error) {
    console.error('[Backup] Error during backup:', error);
    throw error;
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      console.log(`[Backup] Cleaning up ${filesToDelete.length} old backup(s)...`);
      
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`[Backup] Deleted old backup: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('[Backup] Error cleaning up old backups:', error);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  backupDatabase()
    .then(() => {
      console.log('[Backup] Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Backup] Script failed:', error);
      process.exit(1);
    });
}

export { backupDatabase };
