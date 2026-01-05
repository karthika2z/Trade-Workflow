import express from 'express';
import { getMaskedConfig, updateConfig, getConfig } from '../storage/fileStorage.js';

const router = express.Router();

/**
 * GET /api/settings
 * Get API keys (masked for security)
 */
router.get('/', async (req, res) => {
  try {
    const maskedConfig = await getMaskedConfig();

    // Format response to match frontend expectations
    const settings = {
      openai: {
        apiKey: maskedConfig.openai_api_key || '',
        hasKey: maskedConfig.has_openai_key
      },
      anthropic: {
        apiKey: maskedConfig.anthropic_api_key || '',
        hasKey: maskedConfig.has_anthropic_key
      },
      tradingview: {
        apiKey: maskedConfig.tradingview_api_key || '',
        hasKey: maskedConfig.has_tradingview_key
      }
    };

    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/settings
 * Update API keys
 */
router.put('/', async (req, res) => {
  try {
    const updates = {};

    // Update OpenAI key if provided and not masked
    if (req.body.openai?.apiKey && !req.body.openai.apiKey.includes('••••')) {
      const apiKey = req.body.openai.apiKey.trim();

      // Basic validation for OpenAI key format
      if (!apiKey.startsWith('sk-')) {
        return res.status(400).json({
          error: 'Invalid OpenAI API key',
          message: 'OpenAI API keys must start with "sk-"'
        });
      }

      updates.openai_api_key = apiKey;
    }

    // Update Anthropic key if provided and not masked
    if (req.body.anthropic?.apiKey && !req.body.anthropic.apiKey.includes('••••')) {
      const apiKey = req.body.anthropic.apiKey.trim();

      // Basic validation for Anthropic key format
      if (!apiKey.startsWith('sk-ant-')) {
        return res.status(400).json({
          error: 'Invalid Anthropic API key',
          message: 'Anthropic API keys must start with "sk-ant-"'
        });
      }

      updates.anthropic_api_key = apiKey;
    }

    // Update TradingView key if provided and not masked
    if (req.body.tradingview?.apiKey && !req.body.tradingview.apiKey.includes('••••')) {
      const apiKey = req.body.tradingview.apiKey.trim();
      updates.tradingview_api_key = apiKey;
    }

    if (Object.keys(updates).length > 0) {
      await updateConfig(updates);
    }

    res.json({ success: true, message: 'API keys updated successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/settings/:provider
 * Delete a specific API key
 */
router.delete('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;

    const validProviders = ['openai', 'anthropic', 'tradingview'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: `Provider must be one of: ${validProviders.join(', ')}`
      });
    }

    const keyMap = {
      openai: 'openai_api_key',
      anthropic: 'anthropic_api_key',
      tradingview: 'tradingview_api_key'
    };

    await updateConfig({ [keyMap[provider]]: '' });

    res.json({ success: true, message: `${provider} API key deleted successfully` });
  } catch (err) {
    console.error('Delete API key error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
