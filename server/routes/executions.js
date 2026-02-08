import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  getWorkflowById,
  getExecutions,
  createExecution,
  getApiKey
} from '../storage/fileStorage.js';

const router = express.Router();

// TradingView Charts API URL (platform-provided service)
const CHART_SERVICE_URL = 'https://tradingview-charts-891341779188.us-central1.run.app';

// Latest model mappings
const LATEST_MODELS = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514'
};

// Resolve 'latest' to actual model ID
function resolveModel(model, provider) {
  if (model === 'latest') {
    return LATEST_MODELS[provider] || model;
  }
  return model;
}

// Normalize interval to TradingView format
function normalizeInterval(interval) {
  const mapping = {
    '1': '1', '2': '2', '3': '3', '5': '5', '15': '15', '30': '30', '45': '45',
    '1m': '1', '2m': '2', '3m': '3', '5m': '5', '15m': '15', '30m': '30', '45m': '45',
    '60': '60', '120': '120', '180': '180', '240': '240', '360': '360', '480': '480', '720': '720',
    '1h': '60', '2h': '120', '3h': '180', '4h': '240', '6h': '360', '8h': '480', '12h': '720',
    'D': 'D', '1D': 'D', '2D': '2D', '3D': '3D',
    'W': 'W', '1W': 'W',
    'M': 'M', '1M': 'M', '3M': '3M', '6M': '6M', '1Y': '12M'
  };
  return mapping[interval] || interval;
}

/**
 * Fetch chart image from TradingView service
 */
async function fetchChartImage(chartConfig, symbol) {
  const { interval, indicators = [], resolution = '1920x1080' } = chartConfig;
  const normalizedInterval = normalizeInterval(interval);

  // Parse resolution (format: "widthxheight")
  const [width, height] = resolution.split('x').map(v => v.trim());

  const params = new URLSearchParams({
    symbol: symbol,
    interval: normalizedInterval,
    style: '1',
    width: width || '1920',
    height: height || '1080',
    format: 'png'
  });

  if (indicators.length > 0) {
    params.append('studies', indicators.join(','));
  }

  console.log('DEBUG - Fetching chart:', {
    symbol,
    interval: normalizedInterval,
    indicators,
    indicatorsLength: indicators.length,
    studies: indicators.join(',')
  });

  // Get TradingView API key from config
  const tradingviewApiKey = await getApiKey('tradingview');

  const url = `${CHART_SERVICE_URL}/v1/tradingview/advanced-chart?${params}`;
  console.log('DEBUG - TradingView URL:', url);

  try {
    const response = await axios.get(url, {
      headers: {
        'x-api-key': tradingviewApiKey
      },
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const base64 = Buffer.from(response.data).toString('base64');
    return {
      success: true,
      image: `data:image/png;base64,${base64}`,
      config: chartConfig
    };
  } catch (err) {
    console.error('Chart API Error:', {
      status: err.response?.status,
      error: err.message,
      symbol,
      interval: normalizedInterval
    });

    return {
      success: false,
      error: `${err.response?.status || 'Network'} Error: ${err.message}`,
      config: chartConfig
    };
  }
}

/**
 * Analyze charts with OpenAI
 */
async function analyzeWithOpenAI(apiKey, config, images, userPrompt) {
  const openai = new OpenAI({ apiKey });

  // Build content array with labeled images
  const imageContents = [];
  images.forEach((img, idx) => {
    const chartLabel = img.label || `Chart ${idx + 1}`;
    const intervalInfo = img.config?.interval ? ` (${img.config.interval})` : '';
    imageContents.push({
      type: 'text',
      text: `--- ${chartLabel}${intervalInfo} ---`
    });
    imageContents.push({
      type: 'image_url',
      image_url: { url: img.image, detail: 'high' }
    });
  });

  const messages = [
    ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
    {
      role: 'user',
      content: [
        ...imageContents,
        { type: 'text', text: userPrompt || 'Analyze these charts and provide trading signals.' }
      ]
    }
  ];

  const response = await openai.chat.completions.create({
    model: resolveModel(config.model, 'openai') || 'gpt-4o',
    messages,
    temperature: config.temperature ?? 0.7,
    ...(config.topPEnabled && config.topP !== undefined && { top_p: config.topP }),
    max_tokens: 4096
  });

  return response.choices[0].message.content;
}

/**
 * Analyze charts with Claude
 */
async function analyzeWithClaude(apiKey, config, images, userPrompt) {
  const anthropic = new Anthropic({ apiKey });

  // Build content array with labeled images
  const imageContents = [];
  images.forEach((img, idx) => {
    const chartLabel = img.label || `Chart ${idx + 1}`;
    const intervalInfo = img.config?.interval ? ` (${img.config.interval})` : '';
    imageContents.push({
      type: 'text',
      text: `--- ${chartLabel}${intervalInfo} ---`
    });
    imageContents.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: img.image.replace('data:image/png;base64,', '')
      }
    });
  });

  const response = await anthropic.messages.create({
    model: resolveModel(config.model, 'anthropic') || 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: config.systemPrompt || undefined,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContents,
          { type: 'text', text: userPrompt || 'Analyze these charts and provide trading signals.' }
        ]
      }
    ],
    ...(config.temperature !== undefined && { temperature: config.temperature }),
    ...(config.topPEnabled && config.topP !== undefined && { top_p: config.topP })
  });

  return response.content[0].text;
}

/**
 * Forward response to webhook
 */
async function forwardToWebhook(webhookConfig, data) {
  if (!webhookConfig?.url) {
    return { success: false, error: 'No webhook URL configured' };
  }

  try {
    const headers = webhookConfig.headers || {};
    const response = await axios({
      method: webhookConfig.method || 'POST',
      url: webhookConfig.url,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      data: webhookConfig.bodyTemplate
        ? JSON.parse(webhookConfig.bodyTemplate.replace('{{response}}', JSON.stringify(data)))
        : data,
      timeout: 10000
    });

    return { success: true, status: response.status, data: response.data };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      status: err.response?.status,
      data: err.response?.data
    };
  }
}

/**
 * GET /api/executions
 * Get execution history
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const executions = await getExecutions(limit);
    res.json(executions);
  } catch (err) {
    console.error('Get executions error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/execute/:workflowId
 * Execute workflow with SSE streaming for real-time updates
 * Supports overrides via POST body
 */
router.post('/:workflowId', async (req, res) => {
  const executionId = uuidv4();
  const startTime = Date.now();

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUpdate = (step, status, data) => {
    res.write(`data: ${JSON.stringify({ step, status, data, timestamp: Date.now() })}\n\n`);
  };

  try {
    // Get workflow from file storage
    const workflow = await getWorkflowById(req.params.workflowId);

    if (!workflow) {
      sendUpdate('error', 'failed', { message: 'Workflow not found' });
      return res.end();
    }

    // Get overrides from request body
    const overrides = req.body || {};
    const effectiveSymbol = overrides.symbol || workflow.symbol;

    sendUpdate('init', 'completed', {
      workflowName: workflow.name,
      executionId,
      symbol: effectiveSymbol
    });

    // Get API keys from config
    sendUpdate('api_keys', 'running', { message: 'Loading API keys...' });

    const requiredProvider = workflow.aiProvider || workflow.ai_provider;
    const apiKey = await getApiKey(requiredProvider);

    if (!apiKey) {
      sendUpdate('api_keys', 'failed', {
        message: `Missing ${requiredProvider} API key. Please add it in Settings.`,
        provider: requiredProvider
      });
      return res.end();
    }
    sendUpdate('api_keys', 'completed', { message: 'API keys loaded' });

    // Fetch charts - apply overrides if provided
    sendUpdate('charts', 'running', { message: 'Fetching chart images...' });

    // Merge overrides with workflow config to preserve indicators
    const baseHighTimeframe = workflow.highTimeframe || workflow.high_timeframe;
    const baseMidTimeframe = workflow.midTimeframe || workflow.mid_timeframe;
    const baseLowTimeframe = workflow.lowTimeframe || workflow.low_timeframe;

    console.log('DEBUG SSE - Base timeframes:', {
      high: baseHighTimeframe,
      mid: baseMidTimeframe,
      low: baseLowTimeframe,
      overrides: overrides
    });

    const highTimeframe = overrides.highTimeframe
      ? { ...baseHighTimeframe, ...overrides.highTimeframe }
      : baseHighTimeframe;
    const midTimeframe = overrides.midTimeframe
      ? { ...baseMidTimeframe, ...overrides.midTimeframe }
      : baseMidTimeframe;
    const lowTimeframe = overrides.lowTimeframe
      ? { ...baseLowTimeframe, ...overrides.lowTimeframe }
      : baseLowTimeframe;

    console.log('DEBUG SSE - Final timeframes:', {
      high: highTimeframe,
      mid: midTimeframe,
      low: lowTimeframe
    });

    const chartConfigs = [
      { ...highTimeframe, label: 'High Timeframe' },
      ...(midTimeframe?.enabled ? [{ ...midTimeframe, label: 'Mid Timeframe' }] : []),
      { ...lowTimeframe, label: 'Low Timeframe' }
    ];

    const chartResults = [];
    for (const chartConfig of chartConfigs) {
      sendUpdate('charts', 'running', { message: `Fetching ${chartConfig.label} chart...` });
      const result = await fetchChartImage(chartConfig, effectiveSymbol);
      result.label = chartConfig.label;
      chartResults.push(result);

      if (!result.success) {
        sendUpdate('charts', 'warning', {
          message: `Failed to fetch ${chartConfig.label}: ${result.error}`,
          chart: result
        });
      }
    }

    const successfulCharts = chartResults.filter(c => c.success);
    if (successfulCharts.length === 0) {
      sendUpdate('charts', 'failed', { message: 'No charts could be fetched' });
      return res.end();
    }

    sendUpdate('charts', 'completed', {
      message: `Fetched ${successfulCharts.length} charts`,
      charts: chartResults.map(c => ({
        label: c.label,
        success: c.success,
        image: c.success ? c.image : null
      }))
    });

    // AI Analysis
    sendUpdate('analysis', 'running', { message: 'Analyzing charts with AI...' });

    const aiConfig = workflow.aiConfig || workflow.ai_config;
    const userPrompt = workflow.userPrompt || workflow.user_prompt;

    let aiResponse;
    try {
      if (requiredProvider === 'openai') {
        aiResponse = await analyzeWithOpenAI(
          apiKey,
          aiConfig,
          successfulCharts,
          userPrompt
        );
      } else {
        aiResponse = await analyzeWithClaude(
          apiKey,
          aiConfig,
          successfulCharts,
          userPrompt
        );
      }

      // Try to parse as JSON
      let parsedResponse = aiResponse;
      try {
        const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[1]);
        } else {
          parsedResponse = JSON.parse(aiResponse);
        }
      } catch {
        // Keep as string if not valid JSON
      }

      sendUpdate('analysis', 'completed', {
        message: 'AI analysis complete',
        response: parsedResponse,
        raw: aiResponse
      });

      aiResponse = parsedResponse;
    } catch (err) {
      console.error('AI analysis error:', err);
      sendUpdate('analysis', 'failed', { message: `AI analysis failed: ${err.message}` });
      return res.end();
    }

    // Webhook
    let webhookResult = null;
    if (workflow.webhook?.enabled && workflow.webhook?.url) {
      sendUpdate('webhook', 'running', { message: 'Forwarding to webhook...' });

      webhookResult = await forwardToWebhook(workflow.webhook, aiResponse);

      if (webhookResult.success) {
        sendUpdate('webhook', 'completed', {
          message: 'Webhook delivered successfully',
          response: webhookResult
        });
      } else {
        sendUpdate('webhook', 'failed', {
          message: `Webhook failed: ${webhookResult.error}`,
          response: webhookResult
        });
      }
    } else {
      sendUpdate('webhook', 'skipped', { message: 'No webhook configured' });
    }

    // Save execution record to file storage
    await createExecution({
      id: executionId,
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      symbol: effectiveSymbol,
      duration: Date.now() - startTime,
      charts: chartResults.map(c => ({
        label: c.label,
        success: c.success,
        interval: c.config?.interval,
        image: c.success ? c.image : null
      })),
      ai_response: aiResponse,
      webhook_response: webhookResult,
      status: 'completed'
    });

    sendUpdate('complete', 'completed', {
      message: 'Workflow execution complete',
      executionId,
      duration: Date.now() - startTime
    });

  } catch (err) {
    console.error('Workflow execution error:', err);
    sendUpdate('error', 'failed', { message: err.message });
  }

  res.end();
});

/**
 * POST /api/executions/run/:workflowId
 * Simple execution endpoint (non-SSE) for API calls
 * Returns analysis + chart images as JSON
 *
 * This endpoint is ideal for programmatic/API access since it returns
 * a single JSON response instead of Server-Sent Events.
 */
router.post('/run/:workflowId', async (req, res) => {
  try {
    // Get workflow from file storage
    const workflow = await getWorkflowById(req.params.workflowId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Get overrides from request body
    const overrides = req.body || {};
    const effectiveSymbol = overrides.symbol || workflow.symbol;

    // Get API key from config (support both camelCase and snake_case)
    const aiProvider = workflow.aiProvider || workflow.ai_provider;
    const apiKey = await getApiKey(aiProvider);

    if (!apiKey) {
      return res.status(400).json({
        error: `Missing ${aiProvider} API key`,
        message: `Please add your ${aiProvider} API key in Settings.`
      });
    }

    // Fetch charts (support both camelCase and snake_case field names)
    // Merge overrides with workflow config to preserve indicators
    const baseHighTimeframe = workflow.highTimeframe || workflow.high_timeframe;
    const baseMidTimeframe = workflow.midTimeframe || workflow.mid_timeframe;
    const baseLowTimeframe = workflow.lowTimeframe || workflow.low_timeframe;

    console.log('DEBUG - Base timeframes:', {
      high: baseHighTimeframe,
      mid: baseMidTimeframe,
      low: baseLowTimeframe,
      overrides: overrides
    });

    const highTimeframe = overrides.highTimeframe
      ? { ...baseHighTimeframe, ...overrides.highTimeframe }
      : baseHighTimeframe;
    const midTimeframe = overrides.midTimeframe
      ? { ...baseMidTimeframe, ...overrides.midTimeframe }
      : baseMidTimeframe;
    const lowTimeframe = overrides.lowTimeframe
      ? { ...baseLowTimeframe, ...overrides.lowTimeframe }
      : baseLowTimeframe;

    console.log('DEBUG - Final timeframes:', {
      high: highTimeframe,
      mid: midTimeframe,
      low: lowTimeframe
    });

    const chartConfigs = [
      { ...highTimeframe, label: 'High Timeframe' },
      ...(midTimeframe?.enabled ? [{ ...midTimeframe, label: 'Mid Timeframe' }] : []),
      { ...lowTimeframe, label: 'Low Timeframe' }
    ];

    const chartResults = await Promise.all(
      chartConfigs.map(async (chartConfig) => {
        const result = await fetchChartImage(chartConfig, effectiveSymbol);
        result.label = chartConfig.label;
        return result;
      })
    );

    const successfulCharts = chartResults.filter(c => c.success);
    if (successfulCharts.length === 0) {
      return res.status(500).json({ error: 'No charts could be fetched' });
    }

    // AI Analysis (support both camelCase and snake_case)
    const aiConfig = workflow.aiConfig || workflow.ai_config;
    const userPrompt = workflow.userPrompt || workflow.user_prompt;

    let aiResponse;
    if (aiProvider === 'openai') {
      aiResponse = await analyzeWithOpenAI(
        apiKey,
        aiConfig,
        successfulCharts,
        userPrompt
      );
    } else {
      aiResponse = await analyzeWithClaude(
        apiKey,
        aiConfig,
        successfulCharts,
        userPrompt
      );
    }

    // Parse JSON if possible
    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[1]);
      } else {
        aiResponse = JSON.parse(aiResponse);
      }
    } catch {
      // Keep as string
    }

    // Webhook
    let webhookResult = null;
    if (workflow.webhook?.enabled && workflow.webhook?.url) {
      webhookResult = await forwardToWebhook(workflow.webhook, aiResponse);
    }

    // Save execution to file storage
    await createExecution({
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      symbol: effectiveSymbol,
      charts: chartResults.map(c => ({
        label: c.label,
        success: c.success,
        interval: c.config?.interval
      })),
      ai_response: aiResponse,
      webhook_response: webhookResult,
      status: 'completed'
    });

    // Return response (images excluded by default to reduce payload size)
    const includeImages = req.query.includeImages === 'true';

    res.json({
      success: true,
      workflow: workflow.name,
      symbol: effectiveSymbol,
      analysis: aiResponse,
      charts: successfulCharts.map(c => ({
        label: c.label,
        interval: c.config?.interval,
        ...(includeImages && { image: c.image })
      })),
      webhook: webhookResult,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Run workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
