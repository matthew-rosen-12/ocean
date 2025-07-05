import express from 'express';
import { aiChatService } from '../services/ai-chat-service';
import { ollamaChatService } from '../services/ollama-chat-service';
import { NPCInteraction, interactionToPrompt } from 'shared/interaction-prompts';

const router = express.Router();

// Get the configured LLM service
function getLLMService() {
  const provider = process.env.LLM_PROVIDER || 'google';
  return provider === 'ollama' ? ollamaChatService : aiChatService;
}

// New route for structured interactions
router.post('/generate-from-interaction', async (req, res) => {
  try {
    const { interaction }: { interaction: NPCInteraction } = req.body;
    
    if (!interaction || !interaction.type || !interaction.npcFaceFileName) {
      return res.status(400).json({ error: 'Valid NPCInteraction object is required' });
    }

    const prompt = interactionToPrompt(interaction);
    const llmService = getLLMService();
    const response = await llmService.generateResponse(prompt);
    res.json({ response, prompt, provider: process.env.LLM_PROVIDER || 'google' }); // Include provider info
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Legacy route for backward compatibility (plain string prompts)
router.post('/generate', async (req, res) => {
  try {
    const { interaction } = req.body;
    
    if (!interaction || typeof interaction !== 'string') {
      return res.status(400).json({ error: 'Interaction string is required' });
    }

    const llmService = getLLMService();
    const response = await llmService.generateResponse(interaction);
    res.json({ response, provider: process.env.LLM_PROVIDER || 'google' });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

export default router;