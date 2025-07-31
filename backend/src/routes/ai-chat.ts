import express from 'express';
import { aiChatService } from '../services/ai-chat-service';
import { NPCInteraction, interactionToPrompt } from 'shared/interaction-prompts';

const router = express.Router();

// New route for structured interactions
router.post('/generate-from-interaction', async (req, res) => {
  try {
    const { interaction }: { interaction: NPCInteraction } = req.body;
    
    if (!interaction || !interaction.type || !interaction.npcFaceFileName) {
      return res.status(400).json({ error: 'Valid NPCInteraction object is required' });
    }

    const prompt = interactionToPrompt(interaction);
    const response = await aiChatService.generateResponse(prompt);
    res.json({ response, prompt, provider: 'groq' });
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

    const response = await aiChatService.generateResponse(interaction);
    res.json({ response, provider: 'groq' });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

export default router;