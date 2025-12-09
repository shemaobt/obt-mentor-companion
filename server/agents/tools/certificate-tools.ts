/**
 * Certificate Tools
 * 
 * Tools for attaching certificates to qualifications.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { IStorage } from "../../storage";

/**
 * Create certificate management tools
 */
export function createCertificateTools(storage: IStorage, facilitatorId: string) {
  
  const attachCertificateTool = new DynamicStructuredTool({
    name: "attach_certificate_to_qualification",
    description: "Automatically match and attach a certificate file to the correct qualification in the portfolio. This tool reads certificate content, compares it with existing qualifications, and attaches it to the best match. Use when a user uploads a certificate file.",
    schema: z.object({
      certificateFilePath: z.string().describe("Full path to the uploaded certificate file (PDF, DOCX, JPEG, PNG)"),
      chatId: z.string().optional().describe("Current chat ID for tracking"),
      messageId: z.string().optional().describe("Current message ID for tracking"),
    }),
    func: async ({ certificateFilePath, chatId, messageId }) => {
      try {
        // Extract text from certificate
        const { extractTextFromFile } = await import('../../file-processing');
        const certificateText = await extractTextFromFile(certificateFilePath);
        
        if (!certificateText || certificateText.trim().length === 0) {
          return `Error: Could not extract text from certificate file. Please ensure the file is a valid PDF, DOCX, or image file.`;
        }

        // Get all qualifications
        const qualifications = await storage.getFacilitatorQualifications(facilitatorId);
        
        if (qualifications.length === 0) {
          return `No qualifications found in your portfolio. Please add the qualification details first, then I can attach this certificate to it.`;
        }

        // Find best matching qualification
        const normalizeText = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const certTextNormalized = normalizeText(certificateText.substring(0, 2000)); // Limit to first 2000 chars
        
        let bestMatch: typeof qualifications[0] | null = null;
        let bestScore = 0;
        
        for (const qual of qualifications) {
          const qualText = normalizeText(`${qual.courseTitle} ${qual.institution} ${qual.description || ''}`);
          
          // Simple scoring: count matching words
          const qualWords = qualText.split(/\s+/);
          const matchCount = qualWords.filter(word => word.length > 3 && certTextNormalized.includes(word)).length;
          const score = matchCount / qualWords.length;
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = qual;
          }
        }
        
        if (!bestMatch || bestScore < 0.2) {
          return `Could not find a matching qualification for this certificate. The certificate mentions: "${certificateText.substring(0, 200)}..."\n\nPlease tell me which qualification this certificate is for, or add the qualification first.`;
        }

        // Attach certificate
        await storage.attachCertificateToQualification(bestMatch.id, certificateFilePath, certificateText);
        
        return `Successfully attached certificate to: "${bestMatch.courseTitle}" from ${bestMatch.institution}. Match confidence: ${(bestScore * 100).toFixed(0)}%.`;
      } catch (error: any) {
        console.error(`[Portfolio Tool] attach_certificate_to_qualification failed:`, error);
        return `Error attaching certificate: ${error.message}`;
      }
    },
  });

  return [
    attachCertificateTool,
  ];
}
