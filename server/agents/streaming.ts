/**
 * Streaming Support for LangGraph Agents
 * 
 * Enables real-time token streaming from Gemini to the client.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { CONVERSATIONAL_PROMPT, PORTFOLIO_PROMPT } from "./prompts";
import { getConversationalTools, getPortfolioNodeTools } from "./tools";
import type { IStorage } from "../storage";
import * as fs from "fs/promises";

// Stream callback type
export type StreamCallback = (chunk: string) => void;
export type CompletionCallback = (fullResponse: string) => void;
export type ErrorCallback = (error: Error) => void;

interface StreamingOptions {
  storage: IStorage;
  userId: string;
  facilitatorId: string;
  userMessage: string;
  chatHistory: Array<{ role: string; content: string }>;
  providedContext?: string;
  imageFilePaths?: string[];
  nodeType: 'conversational' | 'portfolio';
  onToken: StreamCallback;
  onComplete: CompletionCallback;
  onError: ErrorCallback;
}

/**
 * Process a message with real-time streaming
 */
export async function processMessageWithStreaming({
  storage,
  userId,
  facilitatorId,
  userMessage,
  chatHistory,
  providedContext,
  imageFilePaths,
  nodeType,
  onToken,
  onComplete,
  onError,
}: StreamingOptions): Promise<void> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    onError(new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required'));
    return;
  }

  // Configure model based on node type
  const temperature = nodeType === 'conversational' ? 0.7 : 0.3;
  const prompt = nodeType === 'conversational' ? CONVERSATIONAL_PROMPT : PORTFOLIO_PROMPT;
  
  // Create streaming model with callbacks
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-pro",
    temperature,
    apiKey,
    maxOutputTokens: 8192,
    timeout: 60000,
    maxRetries: 2,
    streaming: true,
    callbacks: [{
      handleLLMNewToken(token: string) {
        onToken(token);
      },
    }],
  });

  // Get tools
  const tools = nodeType === 'conversational' 
    ? getConversationalTools(storage, facilitatorId)
    : getPortfolioNodeTools(storage, facilitatorId);

  // Create react agent
  const agent = createReactAgent({
    llm: model,
    tools,
    messageModifier: prompt,
  });

  // Format chat history
  const formattedHistory = chatHistory.slice(-10).map(msg => {
    if (msg.role === 'user') {
      return { role: 'human' as const, content: msg.content };
    }
    return { role: 'ai' as const, content: msg.content };
  });

  // Build message content
  let messageContent: any;
  const textContent = providedContext 
    ? `${providedContext}\n\n---\n\nUser Question:\n${userMessage}`
    : userMessage;

  // Handle image attachments for vision processing
  if (imageFilePaths && imageFilePaths.length > 0) {
    console.log(`[Streaming] Processing ${imageFilePaths.length} image(s)`);
    
    const imageContents = await Promise.all(
      imageFilePaths.map(async (filePath) => {
        try {
          const imageBuffer = await fs.readFile(filePath);
          const base64Image = imageBuffer.toString('base64');
          const extension = filePath.split('.').pop()?.toLowerCase();
          const mimeType = extension === 'png' ? 'image/png' : 
                          extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png';
          
          return {
            type: "image_url" as const,
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          };
        } catch (error) {
          console.error(`[Streaming] Error processing image ${filePath}:`, error);
          return null;
        }
      })
    );
    
    const validImages = imageContents.filter(img => img !== null);
    
    if (validImages.length > 0) {
      messageContent = [
        { type: "text" as const, text: textContent },
        ...validImages,
      ];
    } else {
      messageContent = textContent;
    }
  } else {
    messageContent = textContent;
  }

  const humanMessage = new HumanMessage({ content: messageContent });

  try {
    console.log('[Streaming] Invoking agent with streaming...');
    
    // Add timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Agent timeout after 60 seconds')), 60000)
    );

    let fullResponse = '';
    
    // Use streamEvents for real-time token streaming
    const stream = await agent.stream({
      messages: [...formattedHistory, humanMessage],
    }, {
      streamMode: "values",
    });

    // Process the stream
    for await (const event of stream) {
      // Extract the latest AI message content
      if (event.messages) {
        const aiMessages = event.messages.filter((msg: BaseMessage) => 
          msg._getType?.() === 'ai' || (msg as any).role === 'ai'
        );
        if (aiMessages.length > 0) {
          const latestContent = aiMessages[aiMessages.length - 1].content?.toString() || '';
          // Calculate the new tokens (difference from previous)
          if (latestContent.length > fullResponse.length) {
            const newContent = latestContent.slice(fullResponse.length);
            fullResponse = latestContent;
            onToken(newContent);
          }
        }
      }
    }

    console.log('[Streaming] Stream complete');
    onComplete(fullResponse);
    
  } catch (error: any) {
    console.error('[Streaming] Error:', error);
    
    // Provide user-friendly error messages
    if (error?.message?.includes('API key') || error?.message?.includes('authentication') || error?.message?.includes('401')) {
      onError(new Error('Google API key authentication failed.'));
    } else if (error?.message?.includes('quota') || error?.message?.includes('429')) {
      onError(new Error('API quota exceeded.'));
    } else if (error?.message?.includes('timeout')) {
      onError(new Error('Request timed out. Please try again.'));
    } else {
      onError(new Error(`AI agent error: ${error?.message || 'Unknown error occurred'}`));
    }
  }
}

/**
 * Determine which node type should handle a message (simple keyword-based)
 */
export function determineNodeType(message: string): 'conversational' | 'portfolio' {
  const normalizedMessage = message.toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  // Portfolio keywords
  const portfolioKeywords = [
    'adicionar', 'registrar', 'cadastrar', 'incluir',
    'qualificacao', 'qualificação', 'certificado', 'curso', 'diploma',
    'atividade', 'experiencia', 'experiência', 'trabalhei',
    'add', 'register', 'qualification', 'activity', 'experience'
  ];

  for (const keyword of portfolioKeywords) {
    if (normalizedMessage.includes(keyword)) {
      return 'portfolio';
    }
  }

  return 'conversational';
}
