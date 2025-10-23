# How to Publish Safely - PREVENTATIVE APPROACH

## Current Status
- ✅ Production: 30 users with complete data
- ✅ Development: 4 test users  
- ✅ Development schema synchronized with code
- ✅ CSV backup exists: `users(1)_1761235733236.csv`

## What Replit Does When You Publish

According to Replit's official documentation:
> "When making schema changes to your development database, these changes (like adding or deleting columns/tables) will be **automatically applied** to your production database when you publish your app."

**Safe Migration Pattern (per Replit docs):**
> "When modifying database structure, **first add new elements before removing old ones** to maintain compatibility."

## PREVENTATIVE Pre-Publish Check (REQUIRED)

**Before publishing, run this automated safety check:**

```bash
PRODUCTION_DATABASE_URL=<your_prod_url> tsx scripts/pre-publish-check.ts
```

### What This Script Checks

**Comprehensive Checks Across ALL Tables:**

1. ✅ **Production data verification** (confirms your 30 users exist)
2. ✅ **Full schema comparison** (all 18 tables in public schema)
3. ✅ **Destructive change detection** (CRITICAL - blocks publishing):
   - Tables being dropped
   - Columns being removed
   - New NOT NULL columns without defaults  
   - Data type changes (e.g., varchar → integer)
   - Nullability tightening (nullable → NOT NULL)
   - Column length reductions (varchar size decreases)
   - Numeric precision reductions (e.g., numeric(10,2) → numeric(5,2))
   - Numeric scale reductions
4. ✅ **Safe change confirmation**:
   - New tables being added
   - New nullable columns or columns with defaults
   - Nullability relaxing (NOT NULL → nullable)
   - Column length increases
5. ✅ **Evidence-based go/no-go recommendation**

**What This Script CANNOT Detect:**
- Constraint changes (e.g., adding/removing foreign keys, unique constraints)
- Index changes (adding/removing indexes)
- Enum type swaps (e.g., approval_status_enum → approval_status_v2_enum)
- Array element type changes (e.g., text[] → uuid[])
- Enum value changes within same enum type
- Default value changes on existing columns
- Custom type (UDT) internal structure changes
- Application-level incompatibilities

**Important:** 
- This script does NOT create automated backups
- Ensure CSV backup exists: `users(1)_1761235733236.csv`
- Script checks database structure, not application logic compatibility

### Expected Output

```
✅ RECOMMENDATION: SAFE TO PUBLISH
   All checks passed - schema changes are additive only
   Backup exists - you can proceed with publishing
```

If you see this, **publishing is SAFE**.

If you see:
```
🛑 RECOMMENDATION: DO NOT PUBLISH
   X critical issue(s) detected
```

**DO NOT PUBLISH** - contact support or fix the issues first.

## Safe Publishing Workflow

### Step 1: Run Pre-Publish Check
```bash
PRODUCTION_DATABASE_URL=<your_prod_url> tsx scripts/pre-publish-check.ts
```

Wait for the ✅ SAFE TO PUBLISH recommendation.

### Step 2: Publish Your App
Click the "Publish" button in Replit.

### Step 3: Immediately Verify Production (Post-Publish)
```bash
PRODUCTION_DATABASE_URL=<your_prod_url> tsx server/verify-production-users.ts
```

Expected output:
```
✅ SUCCESS! Production has 30 users (expected 30)
```

### Step 4: Test Your Published App
Visit your published URL and verify:
- Users can log in
- Data is intact
- Features work correctly

## Why This Approach is Safe

1. ✅ **PREVENTATIVE:** Checks schema compatibility BEFORE publishing
2. ✅ **REACTIVE:** Verifies data integrity AFTER publishing  
3. ✅ **BACKUP:** CSV backup available for recovery
4. ✅ **EVIDENCE-BASED:** Follows Replit's documented safe migration patterns

## What Makes Changes Safe

According to Replit documentation and database best practices:

### ✅ SAFE Changes (Additive)
- Adding new tables
- Adding nullable columns
- Adding columns with defaults
- Creating indexes
- Adding constraints that don't conflict

### ❌ DANGEROUS Changes (Destructive)
- Dropping tables
- Dropping columns
- Changing column types (especially IDs)
- Making nullable columns NOT NULL (when NULLs exist)
- Renaming columns without migration

## Current Schema Changes

Based on verification:
- ✅ `course_level` column: **nullable with default 'certificate'** (SAFE)
- ✅ No tables being dropped
- ✅ No columns being removed
- ✅ All changes are additive

## If Pre-Publish Check Fails

If you get a 🛑 DO NOT PUBLISH warning:

1. **Review the critical issues** listed in the output
2. **Fix the schema issues** in development
3. **Run `npm run db:push`** to sync development
4. **Run pre-publish check again**
5. Only publish after getting ✅ SAFE TO PUBLISH

## If Something Goes Wrong After Publishing

### Immediate Detection
The post-publish verification script will immediately alert you if users are missing.

### Recovery Plan
1. You have `users(1)_1761235733236.csv` with all 30 production users
2. Access production database via Replit's Database panel
3. Restore users from CSV (manual import or scripted)
4. Contact Replit support to understand what happened

## Decision Guide

**Before Running Pre-Publish Check:**
- Ensure `PRODUCTION_DATABASE_URL` is set correctly
- Ensure you have access to production database
- Have the CSV backup location ready

**After Running Pre-Publish Check:**
- ✅ SAFE TO PUBLISH → Proceed with confidence
- ⚠️  PROCEED WITH CAUTION → Review warnings carefully
- 🛑 DO NOT PUBLISH → Fix issues or contact Replit support

## Next Steps

1. **Now:** Run the pre-publish check
2. **If safe:** Proceed with publishing
3. **After publish:** Run post-publish verification
4. **If issues:** You have backup and verification tools

---

**This preventative approach ensures you have evidence-based confidence before publishing, not just hope.**
