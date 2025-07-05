import express from 'express';
import { aiChatService } from '../services/ai-chat-service';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { interaction } = req.body;
    
    if (!interaction || typeof interaction !== 'string') {
      return res.status(400).json({ error: 'Interaction string is required' });
    }

    const response = await aiChatService.generateResponse(interaction);
    res.json({ response });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

export default router;