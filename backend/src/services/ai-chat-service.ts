import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_AI_API_KEY is not set in environment variables');
  throw new Error('GOOGLE_AI_API_KEY is not set in environment variables');
  // Don't throw error to prevent server crash - handle gracefully in generateResponse
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
}

export const aiChatService = new AIChatService();