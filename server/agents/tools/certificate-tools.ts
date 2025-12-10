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
    description: `Attach a certificate/diploma image from the chat to a qualification.

WORKFLOW:
1. User sends an image in the chat message
2. Look at [ATTACHMENTS IN THIS MESSAGE] in the context to find the attachment ID
3. Call list_qualifications to get the qualification ID
4. Call this tool with both IDs (NEVER show IDs to user)

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
