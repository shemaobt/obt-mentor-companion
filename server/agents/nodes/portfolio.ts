import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "../state";
import { PORTFOLIO_PROMPT } from "../prompts";
import { getPortfolioNodeTools } from "../tools";
import type { IStorage } from "../../storage";

export function createPortfolioNode(storage: IStorage) {
  
  return async function portfolioNode(state: typeof AgentState.State): Promise<Partial<typeof AgentState.State>> {
    console.log('[Portfolio Node] Processing portfolio request...');
    
    const { messages, facilitatorId, portfolioIntent } = state;
    
    if (!facilitatorId) {
      console.error('[Portfolio Node] No facilitator ID provided');
      return {
        response: "I need to know who you are before I can update your portfolio. Please log in.",
        next: 'END',
      };
    }
    
    console.log(`[Portfolio Node] Intent: ${portfolioIntent?.type || 'general'}`);
    
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is required');
    }
    
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-pro",
      temperature: 0.3,
      apiKey,
      maxOutputTokens: 8192,
      timeout: 30000,
      maxRetries: 2,
    });
    
    const tools = getPortfolioNodeTools(storage, facilitatorId);
    
    const agent = createReactAgent({
      llm: model,
      tools,
      messageModifier: PORTFOLIO_PROMPT,
    });
    
    const lastMessage = messages[messages.length - 1];
    let messageContent: string;
    
    if (lastMessage instanceof HumanMessage) {
      messageContent = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);
    } else {
      messageContent = "I want to add something to my portfolio.";
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
      // #region agent log
      console.log('[DEBUG-E] Portfolio Node invoking agent with facilitatorId:', facilitatorId);
      console.log('[DEBUG-E] Message content:', messageContent.substring(0, 200));
      console.log('[DEBUG-E] Available tools:', tools.map(t => t.name).join(', '));
      // #endregion
      console.log('[Portfolio Node] Invoking agent...');
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Agent timeout after 60 seconds')), 60000)
      );
      
      const invokePromise = agent.invoke({
        messages: [...formattedHistory, humanMessage],
      });
      
      const result = await Promise.race([invokePromise, timeoutPromise]);
      // #region agent log
      console.log('[DEBUG-F] Agent result messages count:', result.messages?.length);
      // Log ALL messages to see tool calls and results
      result.messages?.forEach((msg: any, i: number) => {
        const msgType = msg._getType?.() || msg.role || 'unknown';
        const content = typeof msg.content === 'string' ? msg.content.substring(0, 500) : JSON.stringify(msg.content)?.substring(0, 500);
        console.log(`[DEBUG-F] Message[${i}] type=${msgType}: ${content}`);
        if (msg.tool_calls) {
          console.log(`[DEBUG-F] Message[${i}] tool_calls:`, JSON.stringify(msg.tool_calls, null, 2));
        }
      });
      // #endregion
      console.log('[Portfolio Node] Agent invocation successful');
      
      const aiMessages = result.messages.filter((msg: any) => 
        msg.role === 'ai' || msg._getType?.() === 'ai'
      );
      const lastAIMessage = aiMessages[aiMessages.length - 1];
      
      const response = lastAIMessage?.content?.toString() || 
        "I had trouble processing your portfolio request. Please try again.";
      
      return {
        response,
        messages: [new AIMessage({ content: response })],
        next: 'competency',
      };
    } catch (error: any) {
      // #region agent log
      console.error('[DEBUG-G] Portfolio Node CAUGHT ERROR:', error?.message);
      console.error('[DEBUG-G] Error stack:', error?.stack);
      console.error('[DEBUG-G] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      // #endregion
      console.error('[Portfolio Node] Error:', error);
      
      if (error?.message?.includes('API key') || error?.message?.includes('authentication')) {
        throw new Error('Google API key authentication failed.');
      } else if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        throw new Error('API quota exceeded.');
      } else {
        throw new Error(`Portfolio agent error: ${error?.message || 'Unknown error occurred'}`);
      }
    }
  };
}
