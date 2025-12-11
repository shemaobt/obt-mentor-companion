/**
 * Certificate Tools
 * 
 * Tools for attaching certificates to qualifications.
 * Includes AI-powered certificate verification using Gemini Vision.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { IStorage } from "../../storage";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs/promises";

/**
 * Use Gemini Vision to read and analyze certificate content
 */
async function analyzeCertificateWithVision(imagePath: string, qualificationTitle: string): Promise<{
  isMatch: boolean;
  extractedInfo: string;
  confidence: string;
}> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('[Certificate Vision] No API key, skipping verification');
      return { isMatch: true, extractedInfo: 'Verificação não disponível', confidence: 'low' };
    }

    // Read the image file
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this certificate/diploma image and extract the following information:
1. Course/Program name
2. Institution name
3. Date of completion
4. Student name (if visible)

Also, determine if this certificate matches the course: "${qualificationTitle}"

Respond in JSON format:
{
  "courseName": "extracted course name",
  "institution": "extracted institution",
  "date": "extracted date",
  "studentName": "extracted name or null",
  "matchesQualification": true/false,
  "confidence": "high/medium/low",
  "reasoning": "brief explanation"
}`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ]);

    const responseText = result.response.text();
    console.log('[Certificate Vision] Raw response:', responseText);

    // Try to parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isMatch: parsed.matchesQualification ?? true,
        extractedInfo: `Curso: ${parsed.courseName || 'N/A'}, Instituição: ${parsed.institution || 'N/A'}`,
        confidence: parsed.confidence || 'medium',
      };
    }

    return { isMatch: true, extractedInfo: responseText.substring(0, 200), confidence: 'low' };
  } catch (error) {
    console.error('[Certificate Vision] Error analyzing certificate:', error);
    // Don't block attachment if vision fails - just log and continue
    return { isMatch: true, extractedInfo: 'Não foi possível analisar a imagem', confidence: 'low' };
  }
}

/**
 * Create certificate management tools
 */
export function createCertificateTools(storage: IStorage, facilitatorId: string) {
  
  const attachCertificateTool = new DynamicStructuredTool({
    name: "attach_certificate_to_qualification",
    description: `Attach a certificate/diploma image from the chat to a qualification.
This tool will automatically verify if the certificate matches the qualification using AI vision.

WORKFLOW:
1. User sends an image in the chat message
2. Look at [ATTACHMENTS IN THIS MESSAGE] in the context to find the attachment ID
3. Call list_qualifications to get the qualification ID
4. Call this tool with both IDs (NEVER show IDs to user)
5. The tool will verify the certificate matches the course

The attachment ID is found in the context like: "- diploma.jpg (ID: abc-123-def, Type: image/jpeg...)"
Extract the ID value after "(ID: " and before the comma.

Example good response: "Pronto! Anexei o diploma ao seu curso de Teologia."
Example BAD response: "Anexei o attachment abc-123..." ← NEVER do this!`,
    schema: z.object({
      qualificationId: z.string().describe("ID from list_qualifications INTERNAL data - NEVER show to user"),
      attachmentId: z.string().describe("Attachment ID from [ATTACHMENTS IN THIS MESSAGE] context - NEVER show to user"),
    }),
    func: async ({ qualificationId, attachmentId }) => {
      try {
        // Validate IDs
        if (!qualificationId || qualificationId.length < 10) {
          return `Não consegui identificar qual qualificação. Use list_qualifications primeiro para ver suas qualificações.`;
        }
        if (!attachmentId || attachmentId.length < 10) {
          return `Não encontrei a imagem do diploma. Por favor, envie a imagem do certificado junto com a mensagem.`;
        }
        
        // Get qualification name for user-friendly response
        const qualifications = await storage.getFacilitatorQualifications(facilitatorId);
        const qualification = qualifications.find(q => q.id === qualificationId);
        
        if (!qualification) {
          return `Não encontrei essa qualificação no seu portfólio. Use list_qualifications para ver suas qualificações disponíveis.`;
        }
        
        const qualName = qualification.courseTitle || 'qualificação';
        
        // Get attachment info to analyze with vision
        const attachment = await storage.getMessageAttachment(attachmentId);
        if (attachment && attachment.storagePath) {
          try {
            // Analyze certificate with Gemini Vision
            const analysis = await analyzeCertificateWithVision(attachment.storagePath, qualName);
            console.log(`[Certificate Tool] Vision analysis:`, analysis);
            
            // If certificate doesn't match and confidence is high, warn the user
            if (!analysis.isMatch && analysis.confidence === 'high') {
              return `⚠️ Atenção: O certificado que você enviou parece ser de outro curso (${analysis.extractedInfo}). Tem certeza que quer anexar este diploma ao curso "${qualName}"? Se sim, envie a mensagem novamente confirmando.`;
            }
          } catch (visionError) {
            console.log('[Certificate Tool] Vision analysis skipped:', visionError);
            // Continue without vision verification
          }
        }
        
        // Attach the certificate using the message attachment
        await storage.attachCertificateFromMessageAttachment(attachmentId, qualificationId, facilitatorId);
        
        console.log(`[Certificate Tool] ✅ Certificate attached to qualification: ${qualificationId}`);
        
        return `✅ Pronto! Anexei o diploma/certificado ao seu curso "${qualName}". Você pode ver o arquivo na página do Portfólio.`;
      } catch (error: any) {
        console.error(`[Certificate Tool] Error attaching certificate:`, error);
        
        if (error.message?.includes('Unauthorized')) {
          return `Não foi possível anexar este arquivo. Certifique-se de que você enviou a imagem nesta conversa.`;
        }
        if (error.message?.includes('not found')) {
          return `Não encontrei o arquivo ou a qualificação. Por favor, verifique se a imagem foi enviada corretamente.`;
        }
        
        return `Houve um problema ao anexar o certificado. Por favor, tente novamente ou use a interface: Portfólio > Qualificações > Anexar Certificado.`;
      }
    },
  });

  return [
    attachCertificateTool,
  ];
}
