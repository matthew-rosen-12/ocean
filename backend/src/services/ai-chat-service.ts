import OpenAI from 'openai';
import dotenv from 'dotenv';
import { AIResponse, AIResponseType, SuccessAIResponse, ErrorAIResponse, RateLimitedAIResponse, NPCInteraction } from 'shared/interaction-types';

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('GROQ_API_KEY is not set in environment variables');
  throw new Error('GROQ_API_KEY is not set in environment variables');
}

const groqClient = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://api.groq.com/openai/v1'
});

// Test API key at startup
(async () => {
  try {
    const result = await groqClient.chat.completions.create({
      messages: [{ role: 'user', content: 'test' }],
      model: 'llama-3.1-8b-instant',
      max_tokens: 10
    });
    console.log('API key test successful:', result.choices[0]?.message?.content?.substring(0, 50));
  } catch (error) {
    console.error('API key test failed at startup:', error instanceof Error ? error.message : error);
  }
})();

export class AIChatService {
  // Use llama-3.1-8b-instant for speed, cost-effectiveness, and good rate limits
  private modelName = 'llama-3.1-8b-instant';
  private defaultConfig = {
    max_tokens: 100,     // Limit response length (~75 words)
    temperature: 0.7,    // Balanced creativity
    top_p: 0.9
  };

  async generateResponse(prompt: string): Promise<string> {
    console.log('generateResponse called with API key:', apiKey?.substring(0, 10), 'length:', apiKey?.length);
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set in environment variables');
    }

    
    try {
      const result = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.modelName,
        ...this.defaultConfig
      });
      
      let responseText = result.choices[0]?.message?.content || '';
      
      // Remove beginning and ending quotes
      responseText = responseText.replace(/^["']|["']$/g, '');
      
      // Use actual token counts from API response
      
      return responseText;
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
      const result = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.modelName,
        ...this.defaultConfig
      });
      
      let message = result.choices[0]?.message?.content || '';
      
      // Remove beginning and ending quotes
      message = message.replace(/^["']|["']$/g, '');
            
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