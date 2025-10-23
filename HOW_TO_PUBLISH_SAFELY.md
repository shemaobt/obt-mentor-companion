# How to Publish Safely Without Losing Production Users

## Current Status
- ✅ Production: 30 users with complete data
- ✅ Development: 4 test users  
- ✅ Development schema is synchronized with code
- ✅ CSV backup exists: `users(1)_1761235733236.csv`

## The Problem
Previous deployments wiped your production users. We need to publish without this happening again.

## What We Don't Know
- Exactly how Replit applies database schema changes during publishing
- Why previous publishes wiped production users (possible causes: schema conflicts, ID type changes, or Replit bugs)

## Safe Publishing Strategy

### Before Publishing

#### 1. Verify Current Schema State
Your development database should be in sync with your code:
```bash
npm run db:push
```
**Expected output:** "Changes applied" with no errors

#### 2. Document What You Have
- Production: 30 users (already backed up to CSV)
- Development: 4 users
- Schema: 18 tables, all columns present including `course_level`

### Publishing Options

#### Option A: Publish and Immediately Verify (RECOMMENDED)
1. Click "Publish" in Replit
2. IMMEDIATELY after publish completes, run the verification script:
   ```bash
   PRODUCTION_DATABASE_URL=<your_url> tsx server/verify-production-users.ts
   ```
3. This checks if your 30 users are still there
4. If users are missing, you have the CSV backup to restore

#### Option B: Ask Replit Support First (SAFEST)
Before publishing, contact Replit support:
- "I'm using Drizzle with db:push. How are schema changes applied to production when I publish?"
- "Will publishing trigger any database migrations that could lose data?"
- "Is there a way to preview what database changes will occur before publishing?"

### After Publishing

#### Immediately Verify Production Data
Run this command to check your users:
```bash
PRODUCTION_DATABASE_URL=<your_prod_url> tsx server/verify-production-users.ts
```

Expected output:
```
✅ SUCCESS! Production has 30 users (expected 30)
```

If you see a warning about missing users, **immediately investigate** before users notice.

### If Something Goes Wrong

#### You Have a CSV Backup
The file `users(1)_1761235733236.csv` contains all 30 production users.

#### Recovery Steps
1. Access your production database in Replit's Database panel
2. Check if users table exists and what data it has
3. If users are missing, you can restore from CSV (manual SQL INSERTs or import)
4. Contact Replit support immediately to understand what happened

## Why This Approach is Safe

1. ✅ Your development schema is in sync (no pending destructive changes)
2. ✅ You have a CSV backup of all production users
3. ✅ Verification script will immediately detect data loss
4. ✅ Schema changes have been additive (nullable columns with defaults)

## What Makes Publishing Unsafe

❌ Changing primary key ID types (serial ↔ varchar) - NEVER do this
❌ Making nullable columns NOT NULL when NULLs exist
❌ Dropping columns or tables
❌ Renaming columns without proper migration

Your current schema changes are SAFE (additive only).

## Unknown Risks

We cannot fully predict what Replit will do during publishing because:
- Replit's documentation doesn't specify the exact mechanism
- Previous publishes had issues (cause unknown)
- No way to test without actually publishing

**Recommendation:** Proceed with Option A (publish + verify) or Option B (ask support first) based on your risk tolerance.

## Decision Guide

**Low Risk Tolerance:** Choose Option B (contact support first)
**Medium Risk Tolerance:** Choose Option A (publish + immediate verification)
**High Risk:** NOT RECOMMENDED - you have real users in production

## Next Steps

1. Decide which option fits your risk tolerance
2. If publishing, have the CSV backup ready
3. Be prepared to verify immediately after publish
4. Consider having support contact info ready

The verification script and backup give you a safety net, but cannot prevent data loss - only detect and help recover from it.
