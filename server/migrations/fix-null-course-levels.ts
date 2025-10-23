
import { neon } from "@neondatabase/serverless";

async function fixNullCourseLevels() {
  // Use the same database URL that your app uses
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("❌ No database URL found. Please ensure DATABASE_URL or PRODUCTION_DATABASE_URL is set.");
    process.exit(1);
  }

  console.log("🔄 Connecting to database...");
  const sql = neon(dbUrl);
  
  try {
    // First, check how many records will be affected
    const checkResult = await sql`
      SELECT COUNT(*) as count 
      FROM facilitator_qualifications 
      WHERE course_level IS NULL
    `;
    
    const nullCount = checkResult[0]?.count || 0;
    console.log(`📊 Found ${nullCount} records with NULL course_level`);
    
    if (nullCount === 0) {
      console.log("✅ No records to update. All course_level values are already set.");
      return;
    }
    
    // Perform the update
    console.log("🔧 Updating records...");
    const updateResult = await sql`
      UPDATE facilitator_qualifications 
      SET course_level = 'certificate' 
      WHERE course_level IS NULL
    `;
    
    console.log(`✅ Successfully updated ${nullCount} record(s)`);
    console.log("✅ Migration complete!");
    
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
}

// Run the migration
fixNullCourseLevels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
