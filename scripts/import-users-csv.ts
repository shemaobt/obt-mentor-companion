import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function cleanValue(value: string): string | null {
  if (!value || value === '') return null;
  value = value.trim();
  if (value.startsWith('"""') && value.endsWith('"""')) {
    return value.slice(3, -3);
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

async function importUsers() {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'users(1)_1761235733236.csv');
  
  console.log(`Reading CSV from: ${csvPath}`);
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));
  console.log(`Headers: ${headers.join(', ')}\n`);
  
  let imported = 0;
  let skipped = 0;
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const user: any = {};
      
      headers.forEach((header, index) => {
        user[header] = cleanValue(values[index]);
      });
      
      const userData = {
        id: user.id,
        email: user.email,
        password: user.password,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImageUrl: user.profile_image_url,
        isAdmin: user.is_admin === 'true',
        isSupervisor: user.is_supervisor === 'true',
        supervisorId: user.supervisor_id,
        userThreadId: user.user_thread_id,
        approvalStatus: user.approval_status || 'approved',
        approvedAt: user.approved_at ? new Date(user.approved_at) : null,
        approvedBy: user.approved_by,
        chatCount: parseInt(user.chat_count) || 0,
        messageCount: parseInt(user.message_count) || 0,
        apiUsageCount: parseInt(user.api_usage_count) || 0,
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : null,
        createdAt: user.created_at ? new Date(user.created_at) : new Date(),
        updatedAt: user.updated_at ? new Date(user.updated_at) : new Date(),
      };
      
      await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            isAdmin: userData.isAdmin,
            isSupervisor: userData.isSupervisor,
            supervisorId: userData.supervisorId,
            userThreadId: userData.userThreadId,
            approvalStatus: userData.approvalStatus,
            approvedAt: userData.approvedAt,
            approvedBy: userData.approvedBy,
            chatCount: userData.chatCount,
            messageCount: userData.messageCount,
            apiUsageCount: userData.apiUsageCount,
            lastLoginAt: userData.lastLoginAt,
            updatedAt: new Date(),
          },
        });
      
      imported++;
      console.log(`✓ Imported: ${userData.email} (${userData.firstName} ${userData.lastName})`);
    } catch (error) {
      console.error(`✗ Error importing line ${i}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`\n=== Import Complete ===`);
  console.log(`✓ Successfully imported: ${imported} users`);
  console.log(`✗ Skipped: ${skipped} users`);
}

importUsers().catch(console.error);
