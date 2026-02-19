/**
 * Production User Verification Script
 * 
 * Run this after publishing to verify that all 30 production users are still present.
 * 
 * Usage:
 *   PRODUCTION_DATABASE_URL=your_prod_url tsx backend/verify-production-users.ts
 */

import { neon } from "@neondatabase/serverless";

async function verifyProductionUsers() {
  const productionUrl = process.env.PRODUCTION_DATABASE_URL;
  
  if (!productionUrl) {
    console.error("❌ PRODUCTION_DATABASE_URL environment variable is required");
    console.log("Usage: PRODUCTION_DATABASE_URL=your_prod_url tsx backend/verify-production-users.ts");
    process.exit(1);
  }

  console.log("🔍 Verifying production users...\n");

  try {
    const sql = neon(productionUrl);
    
    const countResult = await sql`SELECT COUNT(*) as count FROM users`;
    const userCount = countResult[0]?.count || 0;
    
    console.log(`📊 Total users in production: ${userCount}`);
    
    const expectedCount = 30;
    
    if (userCount >= expectedCount) {
      console.log(`✅ SUCCESS! Production has ${userCount} users (expected ${expectedCount})`);
    } else {
      console.log(`⚠️  WARNING! Production has only ${userCount} users (expected ${expectedCount})`);
      console.log(`   ${expectedCount - userCount} users are missing!`);
    }
    
    console.log("\n📋 Sample users (first 5):");
    const sampleUsers = await sql`
      SELECT id, email, first_name, last_name, is_admin, is_supervisor, approval_status 
      FROM users 
      ORDER BY email 
      LIMIT 5
    `;
    
    console.table(sampleUsers);
    
    const adminResult = await sql`SELECT COUNT(*) as count FROM users WHERE is_admin = true`;
    const adminCount = adminResult[0]?.count || 0;
    console.log(`\n👑 Admin users: ${adminCount}`);
    
    const supervisorResult = await sql`SELECT COUNT(*) as count FROM users WHERE is_supervisor = true`;
    const supervisorCount = supervisorResult[0]?.count || 0;
    console.log(`👨‍🏫 Supervisor users: ${supervisorCount}`);
    
    const approvedResult = await sql`SELECT COUNT(*) as count FROM users WHERE approval_status = 'approved'`;
    const approvedCount = approvedResult[0]?.count || 0;
    console.log(`✓ Approved users: ${approvedCount}`);
    
    console.log("\n✅ Verification complete!");
    
    if (userCount >= expectedCount) {
      process.exit(0);
    } else {
      console.error("\n❌ User count mismatch detected!");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Error verifying production users:", error);
    process.exit(1);
  }
}

verifyProductionUsers();
