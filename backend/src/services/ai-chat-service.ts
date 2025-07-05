import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_AI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

export class AIChatService {
  // Use the most generous free tier model - Gemini 2.0 Flash (1M TPM, 15 RPM, 200 RPD)
  private model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 100, // Limit response length (~75 words)
      temperature: 0.7,     // Balanced creativity
      topP: 0.9,
      topK: 40
    }
  });

  async generateResponse(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }
}

export const aiChatService = new AIChatService();