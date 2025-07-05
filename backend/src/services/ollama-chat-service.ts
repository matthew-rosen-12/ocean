import axios from 'axios';

export class OllamaChatService {
  private baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  private model = process.env.OLLAMA_MODEL || 'llama3.2:1b'; // Fast CPU model

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 100, // Limit response length (Ollama uses num_predict)
          stop: ['\n\n'], // Stop at double newline for brevity
        }
      }, {
        timeout: 60000 // 60 second timeout for local model
      });

      return response.data.response.trim();
    } catch (error) {
      console.error('Error generating Ollama response:', error);
      throw new Error('Failed to generate Ollama response');
    }
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const ollamaChatService = new OllamaChatService();