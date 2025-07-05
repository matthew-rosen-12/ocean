import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_AI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

export class AIChatService {
  private model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  async generateResponse(interaction: string): Promise<string> {
    try {
      const result = await this.model.generateContent(interaction);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }
}

export const aiChatService = new AIChatService();