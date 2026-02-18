import express from 'express';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
        hasKey: maskedConfig.has_openai_key,
        model: maskedConfig.openai_model || ''
      },
      anthropic: {
        apiKey: maskedConfig.anthropic_api_key || '',
        hasKey: maskedConfig.has_anthropic_key,
        model: maskedConfig.anthropic_model || ''
      },
      gemini: {
        apiKey: maskedConfig.gemini_api_key || '',
        hasKey: maskedConfig.has_gemini_key,
        model: maskedConfig.gemini_model || ''
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

    // Update Gemini key if provided and not masked
    if (req.body.gemini?.apiKey && !req.body.gemini.apiKey.includes('••••')) {
      const apiKey = req.body.gemini.apiKey.trim();

      // Basic validation for Gemini key format
      if (!apiKey.startsWith('AIzaSy')) {
        return res.status(400).json({
          error: 'Invalid Gemini API key',
          message: 'Gemini API keys must start with "AIzaSy"'
        });
      }

      updates.gemini_api_key = apiKey;
    }

    // Update TradingView key if provided and not masked
    if (req.body.tradingview?.apiKey && !req.body.tradingview.apiKey.includes('••••')) {
      const apiKey = req.body.tradingview.apiKey.trim();
      updates.tradingview_api_key = apiKey;
    }

    // Save model IDs (no validation needed — just store as-is)
    if (req.body.openai?.model !== undefined)    updates.openai_model    = req.body.openai.model.trim();
    if (req.body.anthropic?.model !== undefined) updates.anthropic_model = req.body.anthropic.model.trim();
    if (req.body.gemini?.model !== undefined)    updates.gemini_model    = req.body.gemini.model.trim();

    if (Object.keys(updates).length > 0) {
      await updateConfig(updates);
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/test-model
 * Test that a given model ID is valid for the provider
 */
router.post('/test-model', async (req, res) => {
  try {
    const { provider, model } = req.body;
    const validProviders = ['openai', 'anthropic', 'gemini'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }
    if (!model) {
      return res.status(400).json({ success: false, error: 'Model ID is required' });
    }

    const config = await getConfig();
    const keyMap = { openai: 'openai_api_key', anthropic: 'anthropic_api_key', gemini: 'gemini_api_key' };
    const apiKey = config[keyMap[provider]];

    if (!apiKey) {
      return res.status(400).json({ success: false, error: `No ${provider} API key configured` });
    }

    const testPrompt = 'Reply with just the word OK';

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 10
      });
      return res.json({ success: true, response: response.choices[0].message.content.trim() });
    }

    if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: testPrompt }]
      });
      return res.json({ success: true, response: response.content[0].text.trim() });
    }

    if (provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(apiKey);
      const genModel = genAI.getGenerativeModel({ model });
      const result = await genModel.generateContent(testPrompt);
      return res.json({ success: true, response: result.response.text().trim() });
    }
  } catch (err) {
    const message = err.message || 'Unknown error';
    res.json({ success: false, error: message });
  }
});

/**
 * DELETE /api/settings/:provider
 * Delete a specific API key
 */
router.delete('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;

    const validProviders = ['openai', 'anthropic', 'gemini', 'tradingview'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: `Provider must be one of: ${validProviders.join(', ')}`
      });
    }

    const keyMap = {
      openai: 'openai_api_key',
      anthropic: 'anthropic_api_key',
      gemini: 'gemini_api_key',
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
