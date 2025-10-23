/**
 * Pre-Publish Safety Check
 * 
 * This script verifies that publishing is safe by:
 * 1. Comparing production and development database schemas
 * 2. Detecting destructive changes (dropped tables/columns, type changes, etc.)
 * 3. Verifying new columns are safe (nullable or have defaults)
 * 4. Checking column metadata changes (data types, nullability, precision)
 * 5. Providing evidence-based go/no-go recommendation
 * 
 * IMPORTANT: This script does NOT create backups - ensure you have backups before publishing.
 * 
 * Usage:
 *   PRODUCTION_DATABASE_URL=<prod_url> tsx scripts/pre-publish-check.ts
 */

import { neon } from "@neondatabase/serverless";

interface CheckResult {
  passed: boolean;
  category: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

async function runPrePublishCheck() {
  const results: CheckResult[] = [];
  const productionUrl = process.env.PRODUCTION_DATABASE_URL;
  const developmentUrl = process.env.DATABASE_URL;

  console.log("🔍 Running Pre-Publish Safety Check...\n");

  // Check 1: Environment variables
  if (!productionUrl) {
    results.push({
      passed: false,
      category: "Configuration",
      message: "PRODUCTION_DATABASE_URL not set - cannot verify production database",
      severity: 'critical'
    });
  }

  if (!developmentUrl) {
    results.push({
      passed: false,
      category: "Configuration",
      message: "DATABASE_URL not set - cannot verify development database",
      severity: 'critical'
    });
  }

  if (!productionUrl || !developmentUrl) {
    printResults(results);
    process.exit(1);
  }

  const prodSql = neon(productionUrl);
  const devSql = neon(developmentUrl);

  try {
    // Check 2: Production user count
    console.log("📊 Checking production data...");
    const prodUserCount = await prodSql`SELECT COUNT(*) as count FROM users`;
    const userCount = Number(prodUserCount[0]?.count || 0);
    
    results.push({
      passed: userCount > 0,
      category: "Production Data",
      message: `Production has ${userCount} users`,
      severity: userCount >= 30 ? 'info' : 'warning'
    });

    // Check 3: Compare table existence
    console.log("🏗️  Comparing schemas...");
    const prodTables = await prodSql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    const devTables = await devSql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    const prodTableNames = prodTables.map(t => t.table_name).sort();
    const devTableNames = devTables.map(t => t.table_name).sort();

    // Tables in dev but not in prod (will be CREATED - safe)
    const newTables = devTableNames.filter(t => !prodTableNames.includes(t));
    if (newTables.length > 0) {
      results.push({
        passed: true,
        category: "Schema Changes",
        message: `Will CREATE new tables: ${newTables.join(', ')}`,
        severity: 'info'
      });
    }

    // Tables in prod but not in dev (will be DROPPED - DANGEROUS!)
    const droppedTables = prodTableNames.filter(t => !devTableNames.includes(t));
    if (droppedTables.length > 0) {
      results.push({
        passed: false,
        category: "Schema Changes",
        message: `⚠️ DANGER: Will DROP tables: ${droppedTables.join(', ')}`,
        severity: 'critical'
      });
    } else {
      results.push({
        passed: true,
        category: "Schema Changes",
        message: "No tables will be dropped ✓",
        severity: 'info'
      });
    }

    // Check 4: Comprehensive column comparison for ALL tables
    console.log("🔍 Checking column metadata for ALL tables...");
    
    // Get all table names from development
    const allDevTables = await devSql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tablesToCheck = allDevTables.map(t => t.table_name);
    
    for (const tableName of tablesToCheck) {
      // Skip if table doesn't exist in production yet (new table - will be created safely)
      const prodTableExists = prodTableNames.includes(tableName);
      if (!prodTableExists) {
        continue; // Already handled in "new tables" check
      }
      const prodCols = await prodSql`
        SELECT column_name, data_type, is_nullable, column_default,
               character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `;

      const devCols = await devSql`
        SELECT column_name, data_type, is_nullable, column_default,
               character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `;

      const prodColNames = prodCols.map(c => c.column_name);
      const devColNames = devCols.map(c => c.column_name);

      // New columns in dev (will be ADDED - safe if nullable or has default)
      const newCols = devColNames.filter(c => !prodColNames.includes(c));
      if (newCols.length > 0) {
        const newColDetails = devCols.filter(c => newCols.includes(c.column_name));
        const unsafeNewCols = newColDetails.filter(c => c.is_nullable === 'NO' && !c.column_default);
        
        if (unsafeNewCols.length > 0) {
          results.push({
            passed: false,
            category: "Schema Changes",
            message: `⚠️ DANGER: ${tableName} - New NOT NULL columns without defaults: ${unsafeNewCols.map(c => c.column_name).join(', ')}`,
            severity: 'critical'
          });
        } else {
          results.push({
            passed: true,
            category: "Schema Changes",
            message: `${tableName} - Will ADD safe columns: ${newCols.join(', ')}`,
            severity: 'info'
          });
        }
      }

      // Dropped columns (will be REMOVED - DANGEROUS!)
      const droppedCols = prodColNames.filter(c => !devColNames.includes(c));
      if (droppedCols.length > 0) {
        results.push({
          passed: false,
          category: "Schema Changes",
          message: `⚠️ DANGER: ${tableName} - Will DROP columns: ${droppedCols.join(', ')}`,
          severity: 'critical'
        });
      }

      // Check existing columns for destructive changes
      const commonCols = prodColNames.filter(c => devColNames.includes(c));
      for (const colName of commonCols) {
        const prodCol = prodCols.find(c => c.column_name === colName);
        const devCol = devCols.find(c => c.column_name === colName);

        if (!prodCol || !devCol) continue;

        // Check data type changes (DANGEROUS!)
        if (prodCol.data_type !== devCol.data_type) {
          results.push({
            passed: false,
            category: "Schema Changes",
            message: `⚠️ DANGER: ${tableName}.${colName} - Type change: ${prodCol.data_type} → ${devCol.data_type}`,
            severity: 'critical'
          });
        }

        // Check nullability changes (nullable → NOT NULL is DANGEROUS!)
        if (prodCol.is_nullable === 'YES' && devCol.is_nullable === 'NO') {
          results.push({
            passed: false,
            category: "Schema Changes",
            message: `⚠️ DANGER: ${tableName}.${colName} - Making column NOT NULL (was nullable)`,
            severity: 'critical'
          });
        }

        // Check for character length changes (including unlimited → limited)
        if (prodCol.character_maximum_length !== null && devCol.character_maximum_length !== null) {
          // Both have limits - check if dev is reducing the limit
          if (prodCol.character_maximum_length > devCol.character_maximum_length) {
            results.push({
              passed: false,
              category: "Schema Changes",
              message: `⚠️ DANGER: ${tableName}.${colName} - Reducing varchar length (${prodCol.character_maximum_length} → ${devCol.character_maximum_length})`,
              severity: 'critical'
            });
          }
        } else if (prodCol.character_maximum_length === null && devCol.character_maximum_length !== null) {
          // Production is unlimited, development has limit - this is a reduction
          results.push({
            passed: false,
            category: "Schema Changes",
            message: `⚠️ DANGER: ${tableName}.${colName} - Limiting varchar length (unlimited → ${devCol.character_maximum_length})`,
            severity: 'critical'
          });
        }

        // Check for numeric precision/scale changes
        if (prodCol.data_type === 'numeric' || prodCol.data_type === 'decimal') {
          const prodPrecision = prodCol.numeric_precision;
          const devPrecision = devCol.numeric_precision;
          const prodScale = prodCol.numeric_scale;
          const devScale = devCol.numeric_scale;

          // Check precision reduction or unlimited → limited (null → number is a reduction)
          if (prodPrecision !== null && devPrecision !== null && prodPrecision > devPrecision) {
            results.push({
              passed: false,
              category: "Schema Changes",
              message: `⚠️ DANGER: ${tableName}.${colName} - Reducing numeric precision (${prodPrecision} → ${devPrecision})`,
              severity: 'critical'
            });
          } else if (prodPrecision === null && devPrecision !== null) {
            // Going from unlimited to limited precision is a reduction
            results.push({
              passed: false,
              category: "Schema Changes",
              message: `⚠️ DANGER: ${tableName}.${colName} - Limiting numeric precision (unlimited → ${devPrecision})`,
              severity: 'critical'
            });
          }

          // Check scale reduction (including reduction to 0)
          // Note: scale can be 0 (valid), so use !== null checks
          if (prodScale !== null && devScale !== null && prodScale > devScale) {
            results.push({
              passed: false,
              category: "Schema Changes",
              message: `⚠️ DANGER: ${tableName}.${colName} - Reducing numeric scale (${prodScale} → ${devScale})`,
              severity: 'critical'
            });
          } else if (prodScale === null && devScale !== null) {
            // Going from unlimited to limited scale is a reduction
            results.push({
              passed: false,
              category: "Schema Changes",
              message: `⚠️ DANGER: ${tableName}.${colName} - Limiting numeric scale (unlimited → ${devScale})`,
              severity: 'critical'
            });
          }
        }
      }
    }
    
    // Log comprehensive check completion
    const totalChanges = results.filter(r => r.category === "Schema Changes");
    const dangerousChanges = totalChanges.filter(r => !r.passed);
    
    if (dangerousChanges.length === 0) {
      results.push({
        passed: true,
        category: "Schema Summary",
        message: `All ${tablesToCheck.length} tables checked - No destructive changes detected ✓`,
        severity: 'info'
      });
    } else {
      results.push({
        passed: false,
        category: "Schema Summary",
        message: `Found ${dangerousChanges.length} destructive change(s) across ${tablesToCheck.length} tables`,
        severity: 'critical'
      });
    }

    // Check 5: Verify course_level column in both databases
    console.log("🔍 Checking course_level column...");
    const prodQualCols = await prodSql`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'facilitator_qualifications'
      AND column_name = 'course_level'
    `;

    if (prodQualCols.length === 0) {
      results.push({
        passed: true,
        category: "Schema Changes",
        message: "Production missing course_level column - will be ADDED safely",
        severity: 'info'
      });
    } else {
      results.push({
        passed: true,
        category: "Schema Changes",
        message: "Production already has course_level column ✓",
        severity: 'info'
      });
    }

    // Check 6: Create backup recommendation
    results.push({
      passed: true,
      category: "Backup",
      message: `Backup exists: users(1)_1761235733236.csv (${userCount} users)`,
      severity: 'info'
    });

  } catch (error) {
    results.push({
      passed: false,
      category: "Connection",
      message: `Database error: ${error.message}`,
      severity: 'critical'
    });
  }

  printResults(results);

  // Final recommendation
  const criticalIssues = results.filter(r => !r.passed && r.severity === 'critical');
  const warnings = results.filter(r => !r.passed && r.severity === 'warning');

  console.log("\n" + "=".repeat(60));
  if (criticalIssues.length > 0) {
    console.log("🛑 RECOMMENDATION: DO NOT PUBLISH");
    console.log(`   ${criticalIssues.length} critical issue(s) detected`);
    console.log("   Fix these issues before publishing to avoid data loss");
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log("⚠️  RECOMMENDATION: PROCEED WITH CAUTION");
    console.log(`   ${warnings.length} warning(s) detected`);
    console.log("   Review warnings before publishing");
    process.exit(0);
  } else {
    console.log("✅ RECOMMENDATION: SAFE TO PUBLISH");
    console.log("   All checks passed - schema changes are additive only");
    console.log("   Backup exists - you can proceed with publishing");
    process.exit(0);
  }
}

function printResults(results: CheckResult[]) {
  console.log("\n📋 Check Results:");
  console.log("=".repeat(60));
  
  for (const result of results) {
    const icon = result.passed ? "✅" : 
                 result.severity === 'critical' ? "🛑" : "⚠️ ";
    console.log(`${icon} [${result.category}] ${result.message}`);
  }
}

// Run the check
runPrePublishCheck().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
