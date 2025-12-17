import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "../state";
import { CONVERSATIONAL_PROMPT } from "../prompts";
import { getConversationalTools } from "../tools";
import type { IStorage } from "../../storage";
import * as fs from "fs/promises";

export function createConversationalNode(storage: IStorage) {
  
  return async function conversationalNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    console.log('[Conversational Node] Processing message...');
    
    const { messages, facilitatorId, providedContext, imageFilePaths } = state;
    
    if (!facilitatorId) {
      console.error('[Conversational Node] No facilitator ID provided');
      return {
        response: "I need to know who you are before I can help. Please log in.",
        next: 'END',
      };
    }
    
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required');
    }
    
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-pro",
      temperature: 0.7,
      apiKey,
      maxOutputTokens: 8192,
      timeout: 30000,
      maxRetries: 2,
    });
    
    const tools = getConversationalTools(storage, facilitatorId);
    
    const agent = createReactAgent({
      llm: model,
      tools,
      messageModifier: CONVERSATIONAL_PROMPT,
    });
    
    const lastMessage = messages[messages.length - 1];
    let messageContent: any;
    
    if (lastMessage instanceof HumanMessage) {
      const textContent = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);
      
      const messageWithContext = providedContext 
        ? `${providedContext}\n\n---\n\nUser Question:\n${textContent}`
        : textContent;
      
      if (imageFilePaths && imageFilePaths.length > 0) {
        console.log(`[Conversational Node] Processing ${imageFilePaths.length} image(s)`);
        
        const imageContents = await Promise.all(
          imageFilePaths.map(async (filePath) => {
            try {
              const imageBuffer = await fs.readFile(filePath);
              const base64Image = imageBuffer.toString('base64');
              const extension = filePath.split('.').pop()?.toLowerCase();
              const mimeType = extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png';
              
              return {
                type: "image_url" as const,
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              };
            } catch (error) {
              console.error(`[Conversational Node] Error processing image ${filePath}:`, error);
              return null;
            }
          })
        );
        
        const validImages = imageContents.filter(img => img !== null);
        
        if (validImages.length > 0) {
          messageContent = [
            { type: "text" as const, text: messageWithContext },
            ...validImages,
          ];
        } else {
          messageContent = messageWithContext;
        }
      } else {
        messageContent = messageWithContext;
      }
    } else {
      messageContent = "Hello";
    }
    
    const formattedHistory = messages.slice(0, -1).slice(-10).map(msg => {
      if (msg instanceof HumanMessage) {
        return { role: 'human' as const, content: msg.content };
      } else if (msg instanceof AIMessage) {
        return { role: 'ai' as const, content: msg.content };
      }
      return { role: 'human' as const, content: String(msg.content) };
    });
    
    const humanMessage = new HumanMessage({ content: messageContent });
    
    try {
      console.log('[Conversational Node] Invoking agent...');
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Agent timeout after 60 seconds')), 60000)
      );
      
      const invokePromise = agent.invoke({
        messages: [...formattedHistory, humanMessage],
      });
      
      const result = await Promise.race([invokePromise, timeoutPromise]);
      console.log('[Conversational Node] Agent invocation successful');
      
      const aiMessages = result.messages.filter((msg: any) => 
        msg.role === 'ai' || msg._getType?.() === 'ai'
      );
      const lastAIMessage = aiMessages[aiMessages.length - 1];
      
      const response = lastAIMessage?.content?.toString() || 
        "I apologize, but I wasn't able to generate a response. Please try again.";
      
      return {
        response,
        messages: [new AIMessage({ content: response })],
        next: 'END',
      };
    } catch (error: any) {
      console.error('[Conversational Node] Error:', error);
      
      if (error?.message?.includes('API key') || error?.message?.includes('authentication') || error?.message?.includes('401')) {
        throw new Error('Google API key authentication failed. Please verify your API key.');
      } else if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        throw new Error('API quota exceeded. Please check your Google Cloud billing and quota limits.');
      } else if (error?.message?.includes('permission') || error?.message?.includes('403')) {
        throw new Error('API access denied. Please ensure the Gemini API is enabled.');
      } else {
        throw new Error(`AI agent error: ${error?.message || 'Unknown error occurred'}`);
      }
    }
  };
}
