import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { AIResponse, AIResponseType, SuccessAIResponse, ErrorAIResponse, RateLimitedAIResponse, NPCInteraction } from 'shared/interaction-types';

dotenv.config();

const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_AI_API_KEY is not set in environment variables');
  throw new Error('GOOGLE_AI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

export class AIChatService {
  // Use Gemini 1.0 Pro for maximum concurrent users (15 RPM vs 2 RPM)
  private model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-lite',
    generationConfig: {
      maxOutputTokens: 100, // Limit response length (~75 words)
      temperature: 0.7,     // Balanced creativity
      topP: 0.9,
      topK: 40
    }
  });

  async generateResponse(prompt: string): Promise<string> {
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set in environment variables');
    }    
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async generateStructuredResponse(prompt: string, interaction?: NPCInteraction, userAnimal?: string): Promise<AIResponse> {
    if (!apiKey) {
      return {
        type: AIResponseType.ERROR,
        message: 'AI service unavailable',
        greeting: this.getErrorGreeting(interaction, userAnimal)
      } as ErrorAIResponse;
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const message = response.text();
      
      return {
        type: AIResponseType.SUCCESS,
        message
      } as SuccessAIResponse;
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      
      // Check for rate limiting errors
      if (error?.message?.includes('rate limit') || error?.message?.includes('quota') || error?.status === 429) {
        return {
          type: AIResponseType.RATE_LIMITED,
          message: 'Rate limited',
          greeting: this.getErrorGreeting(interaction, userAnimal)
        } as RateLimitedAIResponse;
      }
      
      return {
        type: AIResponseType.ERROR,
        message: 'Error generating response',
        greeting: this.getErrorGreeting(interaction, userAnimal)
      } as ErrorAIResponse;
    }
  }

  private getErrorGreeting(interaction?: NPCInteraction, userAnimal?: string): string {
    if (!interaction) {
      return `Hi ${userAnimal || 'Unknown'}`;
    }
    
    // "Hi" for capture-related actions
    const hiActions = [
      'CAPTURED_NPC_GROUP',
      'RETURNING_NPC_GROUP_RECAPTURED',
      'IDLE_NPC_CAPTURED_THROWN'
    ];
    
    if (hiActions.includes(interaction.type)) {
      return `Hi ${userAnimal || 'Unknown'}`;
    }
    
    // "Bye" for emit/delete/collision/bounce actions
    return `Bye ${userAnimal || 'Unknown'}`;
  }
}

export const aiChatService = new AIChatService();