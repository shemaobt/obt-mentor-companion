# 📦 Database Backup System

## Quick Commands

### Manual Backup (Run Anytime)
```bash
npx tsx scripts/backup-database.ts
```

### Restore from Backup
```bash
npx tsx scripts/restore-database.ts backup-2025-01-24.sql
```

### List Available Backups
```bash
npx tsx scripts/restore-database.ts
```

---

## 🔄 Automatic Scheduled Backups

To run backups automatically on a schedule using Replit's Scheduled Deployments:

### Option 1: Using Replit UI (Recommended)
1. Go to your Replit workspace
2. Click on **"Deployments"** in the left sidebar
3. Click **"Create deployment"** → **"Scheduled"**
4. Set the schedule (e.g., daily at 2:00 AM)
5. Set the command: `npx tsx scripts/backup-database.ts`
6. Click **"Create"**

### Option 2: Using `.replit` Configuration
Add this to your `.replit` file:

```toml
[[deployment]]
type = "scheduled"
cron = "0 2 * * *"  # Daily at 2:00 AM UTC
command = "npx tsx scripts/backup-database.ts"
```

### Common Cron Schedules
- `0 2 * * *` - Daily at 2:00 AM
- `0 2 * * 0` - Weekly on Sunday at 2:00 AM  
- `0 */6 * * *` - Every 6 hours
- `0 0 1 * *` - Monthly on the 1st at midnight

---

## 📁 Backup Storage

- **Location**: `backups/` directory
- **Format**: SQL dump files
- **Naming**: `backup-YYYY-MM-DD.sql`
- **Retention**: Keeps last 7 backups automatically (older ones are deleted)

---

## 🔧 How It Works

### Backup Process
1. Creates a timestamped SQL dump using `pg_dump`
2. Saves to `backups/backup-YYYY-MM-DD.sql`
3. Automatically deletes backups older than 7 days
4. Uses your `DATABASE_URL` environment variable

### Restore Process
1. Lists available backups
2. Restores selected backup using `psql`
3. ⚠️ **WARNING**: Overwrites current database!

---

## ⚠️ Important Notes

1. **Development vs Production**:
   - These scripts backup your **development** database
   - For production backups, use Replit's built-in point-in-time recovery

2. **Storage Limits**:
   - Each backup consumes disk space
   - Monitor your storage usage
   - Adjust `MAX_BACKUPS` in `scripts/backup-database.ts` if needed

3. **Before Restoring**:
   - Always backup current data first
   - Verify you have the correct backup file
   - Consider testing on development environment first

---

## 🛟 Emergency Recovery

If you need to quickly restore:

```bash
# List all backups
npx tsx scripts/restore-database.ts

# Restore the most recent one
npx tsx scripts/restore-database.ts backup-2025-01-24.sql
```

---

## 📊 Monitoring Backups

Check backup status:
```bash
ls -lh backups/
```

View backup contents (without restoring):
```bash
head -n 50 backups/backup-2025-01-24.sql
```

---

## 🔐 Security Best Practices

- ✅ Backups are stored locally (not committed to git)
- ✅ `backups/` directory is in `.gitignore`
- ⚠️ For production: Use external storage (S3, Google Cloud Storage)
- ⚠️ Never commit backup files with sensitive data

---

## Need Help?

- Check logs after running backup script
- Verify `DATABASE_URL` is set correctly
- Ensure you have disk space available
- Contact support if backups fail consistently
