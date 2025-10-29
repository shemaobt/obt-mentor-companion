// Recalculate competencies for current user
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { calculateCompetencyScores, scoreToStatus } from './server/competency-mapping.js';

// Configure Neon
neonConfig.webSocketConstructor = ws;
config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function recalculateForUser(userEmail) {
  try {
    console.log(`🔍 Finding user: ${userEmail}`);
    
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, userEmail),
    });
    
    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      return;
    }
    
    console.log(`✅ Found user: ${user.fullName} (${user.id})`);
    
    // Find facilitator
    const facilitator = await db.query.facilitators.findFirst({
      where: eq(schema.facilitators.userId, user.id),
    });
    
    if (!facilitator) {
      console.error(`❌ Facilitator profile not found for user: ${user.fullName}`);
      return;
    }
    
    console.log(`✅ Found facilitator: ${facilitator.fullName} (${facilitator.id})`);
    console.log(`\n🔄 Recalculating competencies...\n`);
    
    // Get qualifications
    const qualifications = await db.query.facilitatorQualifications.findMany({
      where: eq(schema.facilitatorQualifications.facilitatorId, facilitator.id),
    });
    
    console.log(`📚 Found ${qualifications.length} qualifications`);
    
    // Get activities
    const activities = await db.query.mentorshipActivities.findMany({
      where: eq(schema.mentorshipActivities.facilitatorId, facilitator.id),
    });
    
    console.log(`🎯 Found ${activities.length} activities`);
    
    // Calculate scores
    const scores = calculateCompetencyScores(qualifications, activities);
    
    console.log(`\n📊 NEW COMPETENCY SCORES:\n`);
    
    // Get existing competencies
    const existingCompetencies = await db.query.facilitatorCompetencies.findMany({
      where: eq(schema.facilitatorCompetencies.facilitatorId, facilitator.id),
    });
    
    const competencyMap = new Map(
      existingCompetencies.map(c => [c.competencyId, c])
    );
    
    // Process all competencies
    const allCompetencyIds = Object.keys(schema.CORE_COMPETENCIES);
    
    for (const competencyId of allCompetencyIds) {
      const totalScore = scores.total.get(competencyId) || 0;
      const educationScore = scores.education.get(competencyId) || 0;
      const experienceScore = scores.experience.get(competencyId) || 0;
      
      const suggestedStatus = scoreToStatus(totalScore);
      const existing = competencyMap.get(competencyId);
      
      const competencyName = schema.CORE_COMPETENCIES[competencyId].name.en;
      
      console.log(`${competencyName}:`);
      console.log(`  Education: ${educationScore.toFixed(1)} pts`);
      console.log(`  Experience: ${experienceScore.toFixed(1)} pts`);
      console.log(`  Total: ${totalScore.toFixed(1)} pts`);
      console.log(`  Level: ${suggestedStatus.toUpperCase()}`);
      console.log();
      
      const notes = `Auto-calculated: Education=${educationScore.toFixed(1)}, Experience=${experienceScore.toFixed(1)}, Total=${totalScore.toFixed(1)}`;
      
      if (existing) {
        // Update existing
        const isManual = existing.statusSource === 'manual';
        const isEvidence = existing.statusSource === 'evidence';
        
        if (isManual || isEvidence) {
          // Preserve manual/evidence status
          await db
            .update(schema.facilitatorCompetencies)
            .set({
              autoScore: Math.round(totalScore),
              suggestedStatus: suggestedStatus,
              lastUpdated: new Date(),
            })
            .where(eq(schema.facilitatorCompetencies.id, existing.id));
          
          console.log(`  ↻ Updated (preserved ${existing.statusSource} status: ${existing.status})`);
        } else {
          // Update auto status
          await db
            .update(schema.facilitatorCompetencies)
            .set({
              status: suggestedStatus,
              autoScore: Math.round(totalScore),
              suggestedStatus: suggestedStatus,
              notes,
              lastUpdated: new Date(),
            })
            .where(eq(schema.facilitatorCompetencies.id, existing.id));
          
          console.log(`  ✓ Updated status to: ${suggestedStatus}`);
        }
      } else {
        // Create new
        await db.insert(schema.facilitatorCompetencies).values({
          facilitatorId: facilitator.id,
          competencyId,
          status: suggestedStatus,
          autoScore: Math.round(totalScore),
          suggestedStatus: suggestedStatus,
          statusSource: 'auto',
          notes,
        });
        
        console.log(`  + Created with status: ${suggestedStatus}`);
      }
    }
    
    console.log(`\n✅ Recalculation complete!`);
    
  } catch (error) {
    console.error(`❌ Error:`, error);
  } finally {
    await pool.end();
  }
}

// Get user email from command line or use default
const userEmail = process.argv[2] || 'user@example.com';
recalculateForUser(userEmail);
