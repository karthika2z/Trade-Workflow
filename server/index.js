import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Latest model mappings - update these when new models are released
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Disable caching for all API responses
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

// Data directories
const DATA_DIR = join(__dirname, '../data');
const WORKFLOWS_FILE = join(DATA_DIR, 'workflows.json');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');
const EXECUTIONS_FILE = join(DATA_DIR, 'executions.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Initialize files if they don't exist
    try {
      await fs.access(WORKFLOWS_FILE);
    } catch {
      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify([], null, 2));
    }
    
    try {
      await fs.access(SETTINGS_FILE);
    } catch {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify({
        AICharts: { apiKey: '' },
        openai: { apiKey: '' },
        anthropic: { apiKey: '' }
      }, null, 2));
    }
    
    try {
      await fs.access(EXECUTIONS_FILE);
    } catch {
      await fs.writeFile(EXECUTIONS_FILE, JSON.stringify([], null, 2));
    }
  } catch (err) {
    console.error('Error initializing data directory:', err);
  }
}

// Helper functions
async function readJSON(file) {
  const data = await fs.readFile(file, 'utf-8');
  return JSON.parse(data);
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// ============== SETTINGS ROUTES ==============

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await readJSON(SETTINGS_FILE);
    // Mask API keys for security
    const masked = {
      AICharts: { apiKey: settings.AICharts?.apiKey ? '••••••••' + settings.AICharts.apiKey.slice(-4) : '' },
      openai: { apiKey: settings.openai?.apiKey ? '••••••••' + settings.openai.apiKey.slice(-4) : '' },
      anthropic: { apiKey: settings.anthropic?.apiKey ? '••••••••' + settings.anthropic.apiKey.slice(-4) : '' }
    };
    res.json(masked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const current = await readJSON(SETTINGS_FILE);
    const updates = req.body;

    // Only update non-masked values
    if (updates.AICharts?.apiKey && !updates.AICharts.apiKey.includes('••••')) {
      current.AICharts = { apiKey: updates.AICharts.apiKey };
    }
    if (updates.openai?.apiKey && !updates.openai.apiKey.includes('••••')) {
      current.openai = { apiKey: updates.openai.apiKey };
    }
    if (updates.anthropic?.apiKey && !updates.anthropic.apiKey.includes('••••')) {
      current.anthropic = { apiKey: updates.anthropic.apiKey };
    }
    
    await writeJSON(SETTINGS_FILE, current);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== WORKFLOW ROUTES ==============

app.get('/api/workflows', async (req, res) => {
  try {
    const workflows = await readJSON(WORKFLOWS_FILE);
    res.json(workflows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workflows/:id', async (req, res) => {
  try {
    const workflows = await readJSON(WORKFLOWS_FILE);
    const workflow = workflows.find(w => w.id === req.params.id || w.name === req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflows', async (req, res) => {
  try {
    const workflows = await readJSON(WORKFLOWS_FILE);
    const newWorkflow = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body
    };
    workflows.push(newWorkflow);
    await writeJSON(WORKFLOWS_FILE, workflows);
    res.json(newWorkflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/workflows/:id', async (req, res) => {
  try {
    const workflows = await readJSON(WORKFLOWS_FILE);
    const index = workflows.findIndex(w => w.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    workflows[index] = {
      ...workflows[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    await writeJSON(WORKFLOWS_FILE, workflows);
    res.json(workflows[index]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/workflows/:id', async (req, res) => {
  try {
    const workflows = await readJSON(WORKFLOWS_FILE);
    const filtered = workflows.filter(w => w.id !== req.params.id);
    await writeJSON(WORKFLOWS_FILE, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== WORKFLOW IMPORT/EXPORT ==============

// Helper to sanitize workflow for export (removes sensitive data)
function sanitizeWorkflowForExport(workflow) {
  const sanitized = { ...workflow };
  // Remove sensitive fields
  if (sanitized.aiConfig) {
    sanitized.aiConfig = { ...sanitized.aiConfig };
    delete sanitized.aiConfig.assistantId; // Remove OpenAI assistant ID
  }
  // Add export metadata
  sanitized._exportedAt = new Date().toISOString();
  sanitized._exportVersion = '1.0';
  return sanitized;
}

// Export single workflow as JSON
app.get('/api/workflows/:id/export', async (req, res) => {
  try {
    const workflows = await readJSON(WORKFLOWS_FILE);
    const workflow = workflows.find(w => w.id === req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const exported = sanitizeWorkflowForExport(workflow);
    res.setHeader('Content-Disposition', `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '-')}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exported);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import workflow from JSON
app.post('/api/workflows/import', async (req, res) => {
  try {
    const importedWorkflow = req.body;

    // Validate required fields
    if (!importedWorkflow.name || !importedWorkflow.symbol) {
      return res.status(400).json({ error: 'Invalid workflow: missing name or symbol' });
    }

    const workflows = await readJSON(WORKFLOWS_FILE);

    // Create new workflow with fresh ID and timestamps
    const newWorkflow = {
      ...importedWorkflow,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Restore assistantId field if missing
      aiConfig: {
        ...importedWorkflow.aiConfig,
        assistantId: importedWorkflow.aiConfig?.assistantId || ''
      }
    };

    // Remove export metadata
    delete newWorkflow._exportedAt;
    delete newWorkflow._exportVersion;

    workflows.push(newWorkflow);
    await writeJSON(WORKFLOWS_FILE, workflows);
    res.json(newWorkflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== COMMUNITY WORKFLOWS ==============

const COMMUNITY_FILE = join(DATA_DIR, 'community.json');

// Ensure community file exists
async function ensureCommunityFile() {
  try {
    await fs.access(COMMUNITY_FILE);
  } catch {
    await fs.writeFile(COMMUNITY_FILE, JSON.stringify({ workflows: [] }, null, 2));
  }
}

// Get all community workflows
app.get('/api/community/workflows', async (req, res) => {
  try {
    await ensureCommunityFile();
    const data = await readJSON(COMMUNITY_FILE);
    // Sort by votes (descending), then by downloads
    const sorted = data.workflows.sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return b.downloads - a.downloads;
    });
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single community workflow
app.get('/api/community/workflows/:id', async (req, res) => {
  try {
    await ensureCommunityFile();
    const data = await readJSON(COMMUNITY_FILE);
    const workflow = data.workflows.find(w => w.id === req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Community workflow not found' });
    }
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Publish workflow to community
app.post('/api/community/publish', async (req, res) => {
  try {
    const { workflowId, name, description, author, tags } = req.body;

    // Get the workflow
    const workflows = await readJSON(WORKFLOWS_FILE);
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await ensureCommunityFile();
    const community = await readJSON(COMMUNITY_FILE);

    // Create community entry
    const communityWorkflow = {
      id: uuidv4(),
      name: name || workflow.name,
      description: description || '',
      author: author || 'Anonymous',
      tags: tags || [],
      votes: 0,
      downloads: 0,
      publishedAt: new Date().toISOString(),
      workflow: sanitizeWorkflowForExport(workflow)
    };

    community.workflows.push(communityWorkflow);
    await writeJSON(COMMUNITY_FILE, community);
    res.json(communityWorkflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import workflow from community
app.post('/api/community/import/:id', async (req, res) => {
  try {
    await ensureCommunityFile();
    const community = await readJSON(COMMUNITY_FILE);
    const communityWorkflow = community.workflows.find(w => w.id === req.params.id);

    if (!communityWorkflow) {
      return res.status(404).json({ error: 'Community workflow not found' });
    }

    const workflows = await readJSON(WORKFLOWS_FILE);

    // Create new local workflow
    const newWorkflow = {
      ...communityWorkflow.workflow,
      id: uuidv4(),
      name: communityWorkflow.workflow.name + ' (imported)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiConfig: {
        ...communityWorkflow.workflow.aiConfig,
        assistantId: ''
      }
    };

    // Remove export metadata
    delete newWorkflow._exportedAt;
    delete newWorkflow._exportVersion;

    workflows.push(newWorkflow);
    await writeJSON(WORKFLOWS_FILE, workflows);

    // Increment download count
    communityWorkflow.downloads++;
    await writeJSON(COMMUNITY_FILE, community);

    res.json(newWorkflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vote for community workflow
app.post('/api/community/vote/:id', async (req, res) => {
  try {
    await ensureCommunityFile();
    const community = await readJSON(COMMUNITY_FILE);
    const workflow = community.workflows.find(w => w.id === req.params.id);

    if (!workflow) {
      return res.status(404).json({ error: 'Community workflow not found' });
    }

    workflow.votes++;
    await writeJSON(COMMUNITY_FILE, community);
    res.json({ votes: workflow.votes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== CHART SERVICE API ==============

const CHART_SERVICE_URL = 'https://tradingview-charts-891341779188.us-central1.run.app';

// Normalize interval to TradingView format
// Accepts: human-readable (1h, 4h, 1D) or minutes (60, 240)
function normalizeInterval(interval) {
  const mapping = {
    // Minutes - pass through as numbers
    '1': '1', '2': '2', '3': '3', '5': '5', '15': '15', '30': '30', '45': '45',
    '1m': '1', '2m': '2', '3m': '3', '5m': '5', '15m': '15', '30m': '30', '45m': '45',
    // Hours to minutes
    '60': '60', '120': '120', '180': '180', '240': '240', '360': '360', '480': '480', '720': '720',
    '1h': '60', '2h': '120', '3h': '180', '4h': '240', '6h': '360', '8h': '480', '12h': '720',
    // Days/Weeks/Months - TradingView format
    'D': 'D', '1D': 'D', '2D': '2D', '3D': '3D',
    'W': 'W', '1W': 'W',
    'M': 'M', '1M': 'M', '3M': '3M', '6M': '6M', '1Y': '12M'
  };
  return mapping[interval] || interval;
}

async function fetchChartImage(settings, chartConfig) {
  const { symbol, interval, indicators = [] } = chartConfig;

  const normalizedInterval = normalizeInterval(interval);

  // Build query parameters
  const params = new URLSearchParams({
    symbol: symbol,
    interval: normalizedInterval,
    style: '1',
    theme: 'light',
    width: '1920',
    height: '1080',
    format: 'png',
    preset: 'ai'  // AI-enhanced for GPT-4V and Claude Vision
  });

  // Add indicators if specified
  if (indicators.length > 0) {
    params.append('studies', indicators.join(','));
  }

  const url = `${CHART_SERVICE_URL}/v1/tradingview/advanced-chart?${params}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'x-api-key': settings.AICharts.apiKey
      },
      responseType: 'arraybuffer'
    });
    const base64 = Buffer.from(response.data).toString('base64');
    return {
      success: true,
      image: `data:image/png;base64,${base64}`,
      config: chartConfig
    };
  } catch (err) {
    // Enhanced error logging
    let errorMessage = err.message;
    if (err.response) {
      // Try to parse the error response
      try {
        const errorData = err.response.data;
        if (Buffer.isBuffer(errorData)) {
          errorMessage = errorData.toString('utf-8');
        } else if (typeof errorData === 'object') {
          errorMessage = JSON.stringify(errorData);
        } else {
          errorMessage = String(errorData);
        }
      } catch (parseErr) {
        errorMessage = err.response.statusText || err.message;
      }
    }

    console.error('❌ Chart API Error:', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      error: errorMessage,
      symbol,
      interval: normalizedInterval,
      url,
      apiKeyPresent: !!settings.AICharts?.apiKey,
      apiKeyLength: settings.AICharts?.apiKey?.length
    });

    return {
      success: false,
      error: `${err.response?.status || 'Network'} Error: ${errorMessage}`,
      config: chartConfig
    };
  }
}

// ============== AI ANALYSIS ==============

async function analyzeWithOpenAI(settings, config, images, userPrompt) {
  const openai = new OpenAI({ apiKey: settings.openai.apiKey });

  // Build content array with labeled images
  // Each image is preceded by a text label so the AI knows which timeframe it represents
  const imageContents = [];
  images.forEach((img, idx) => {
    // Add label text before each image
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
  
  // Use assistant or direct completion
  if (config.assistantId) {
    // Use Assistants API - need to upload images as files first
    const thread = await openai.beta.threads.create();

    // Upload each image as a file
    const fileIds = [];
    for (const img of images) {
      // Convert base64 data URL to buffer
      const base64Data = img.image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Create a File object for upload
      const file = await openai.files.create({
        file: new File([buffer], `chart_${img.label || 'image'}.png`, { type: 'image/png' }),
        purpose: 'assistants'
      });
      fileIds.push(file.id);
    }

    // Create message with file attachments
    const attachments = fileIds.map(id => ({
      file_id: id,
      tools: [{ type: 'code_interpreter' }]
    }));

    // Build message content with chart labels so the assistant knows which file is which
    const chartLabels = images.map((img, idx) => {
      const label = img.label || `Chart ${idx + 1}`;
      const interval = img.config?.interval || 'unknown';
      return `File ${idx + 1}: ${label} (${interval})`;
    }).join('\n');

    const messageContent = `I have attached ${images.length} chart images:\n${chartLabels}\n\n${userPrompt || 'Analyze these charts and provide trading signals.'}`;

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: messageContent,
      attachments
    });
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: config.assistantId
    });
    
    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise(r => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }
    
    if (runStatus.status === 'failed') {
      throw new Error('Assistant run failed: ' + runStatus.last_error?.message);
    }
    
    const messagesResponse = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messagesResponse.data.find(m => m.role === 'assistant');
    
    return assistantMessage?.content[0]?.text?.value || 'No response';
  } else {
    // Direct completion
    const response = await openai.chat.completions.create({
      model: resolveModel(config.model, 'openai') || 'gpt-4o',
      messages,
      temperature: config.temperature ?? 0.7,
      ...(config.topPEnabled && config.topP !== undefined && { top_p: config.topP }),
      max_tokens: 4096
    });
    
    return response.choices[0].message.content;
  }
}

async function analyzeWithClaude(settings, config, images, userPrompt) {
  if (!settings.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured. Please add it in Settings.');
  }

  const anthropic = new Anthropic({ apiKey: settings.anthropic.apiKey });

  // Build content array with labeled images
  // Each image is preceded by a text label so the AI knows which timeframe it represents
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

// ============== WEBHOOK FORWARDING ==============

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
        : data
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

// ============== WORKFLOW EXECUTION ==============

// Support both GET (EventSource) and POST (fetch streaming)
const executeWorkflow = async (req, res) => {
  console.log('Execute workflow called:', req.params.workflowId);
  const executionId = uuidv4();
  const startTime = Date.now();
  
  // Set up SSE for real-time updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers immediately
  
  const sendUpdate = (step, status, data) => {
    console.log('Sending update:', step, status);
    res.write(`data: ${JSON.stringify({ step, status, data, timestamp: Date.now() })}\n\n`);
  };
  
  try {
    const settings = await readJSON(SETTINGS_FILE);
    const workflows = await readJSON(WORKFLOWS_FILE);
    const workflow = workflows.find(w => w.id === req.params.workflowId || w.name === req.params.workflowId);
    
    if (!workflow) {
      sendUpdate('error', 'failed', { message: 'Workflow not found' });
      return res.end();
    }
    
    // Allow overrides from request body
    const config = { ...workflow, ...req.body };
    
    sendUpdate('init', 'completed', { workflowName: workflow.name, executionId });
    
    // Step 1: Fetch charts
    sendUpdate('charts', 'running', { message: 'Fetching chart images...' });
    
    const chartConfigs = [
      { ...config.highTimeframe, label: 'High Timeframe' },
      ...(config.midTimeframe?.enabled ? [{ ...config.midTimeframe, label: 'Mid Timeframe' }] : []),
      { ...config.lowTimeframe, label: 'Low Timeframe' }
    ];
    
    const chartResults = [];
    console.log('Fetching charts in order:');
    for (let i = 0; i < chartConfigs.length; i++) {
      const chartConfig = chartConfigs[i];
      console.log(`  [${i}] Fetching: ${chartConfig.label} (interval: ${chartConfig.interval})`);
      sendUpdate('charts', 'running', { message: `Fetching ${chartConfig.label} chart...` });
      const result = await fetchChartImage(settings, {
        symbol: config.symbol,
        interval: chartConfig.interval,
        indicators: chartConfig.indicators || []
      });
      result.label = chartConfig.label;
      // Store the original interval in the result for verification
      result.originalInterval = chartConfig.interval;
      chartResults.push(result);
      console.log(`  [${i}] Received: ${result.label} (config.interval: ${result.config?.interval}, original: ${result.originalInterval}, success: ${result.success})`);

      if (!result.success) {
        sendUpdate('charts', 'warning', {
          message: `Failed to fetch ${chartConfig.label}: ${result.error}`,
          chart: result
        });
      }
    }

    console.log('Chart results array order:');
    chartResults.forEach((r, i) => console.log(`  [${i}] ${r.label} - interval: ${r.originalInterval}`));
    
    const successfulCharts = chartResults.filter(c => c.success);
    if (successfulCharts.length === 0) {
      sendUpdate('charts', 'failed', { message: 'No charts could be fetched' });
      return res.end();
    }
    
    sendUpdate('charts', 'completed', { 
      message: `Fetched ${successfulCharts.length} charts`,
      charts: chartResults.map(c => ({ label: c.label, success: c.success, image: c.success ? c.image : null }))
    });
    
    // Step 2: AI Analysis
    sendUpdate('analysis', 'running', { message: 'Sending to AI for analysis...' });

    // Log the order of images being sent to AI
    console.log('Images being sent to AI:');
    successfulCharts.forEach((chart, idx) => {
      console.log(`  ${idx + 1}. ${chart.label} - interval: ${chart.config?.interval}`);
    });

    let aiResponse;
    try {
      if (config.aiProvider === 'openai') {
        aiResponse = await analyzeWithOpenAI(settings, config.aiConfig, successfulCharts, config.userPrompt);
      } else {
        aiResponse = await analyzeWithClaude(settings, config.aiConfig, successfulCharts, config.userPrompt);
      }
      
      // Try to parse as JSON
      let parsedResponse = aiResponse;
      try {
        // Extract JSON from markdown code blocks if present
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
      sendUpdate('analysis', 'failed', { message: `AI analysis failed: ${err.message}` });
      return res.end();
    }
    
    // Step 3: Webhook (if configured)
    if (config.webhook?.enabled && config.webhook?.url) {
      sendUpdate('webhook', 'running', { message: 'Forwarding to webhook...' });
      
      const webhookResult = await forwardToWebhook(config.webhook, aiResponse);
      
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
    
    // Save execution record
    const executions = await readJSON(EXECUTIONS_FILE);
    executions.unshift({
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      charts: chartResults.map(c => ({ label: c.label, success: c.success })),
      aiResponse,
      symbol: config.symbol
    });
    // Keep only last 100 executions
    await writeJSON(EXECUTIONS_FILE, executions.slice(0, 100));
    
    sendUpdate('complete', 'completed', { 
      message: 'Workflow execution complete',
      executionId,
      duration: Date.now() - startTime
    });
    
  } catch (err) {
    console.error('Workflow execution error:', err);
    sendUpdate('error', 'failed', { message: err.message, stack: err.stack });
  }
  
  res.end();
};

// Register routes for both GET (EventSource) and POST (fetch streaming)
app.get('/api/execute/:workflowId', executeWorkflow);
app.post('/api/execute/:workflowId', executeWorkflow);

// Simple execution endpoint (non-SSE) for API calls
app.post('/api/run/:workflowId', async (req, res) => {
  try {
    const settings = await readJSON(SETTINGS_FILE);
    const workflows = await readJSON(WORKFLOWS_FILE);
    const workflow = workflows.find(w => w.id === req.params.workflowId || w.name === req.params.workflowId);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    const config = { ...workflow, ...req.body };
    
    // Fetch charts
    const chartConfigs = [
      { ...config.highTimeframe, label: 'High Timeframe' },
      ...(config.midTimeframe?.enabled ? [{ ...config.midTimeframe, label: 'Mid Timeframe' }] : []),
      { ...config.lowTimeframe, label: 'Low Timeframe' }
    ];
    
    const chartResults = await Promise.all(
      chartConfigs.map(async (chartConfig) => {
        const result = await fetchChartImage(settings, {
          symbol: config.symbol,
          interval: chartConfig.interval,
          indicators: chartConfig.indicators || []
        });
        result.label = chartConfig.label;
        return result;
      })
    );
    
    const successfulCharts = chartResults.filter(c => c.success);
    if (successfulCharts.length === 0) {
      return res.status(500).json({ error: 'No charts could be fetched' });
    }
    
    // AI Analysis
    let aiResponse;
    if (config.aiProvider === 'openai') {
      aiResponse = await analyzeWithOpenAI(settings, config.aiConfig, successfulCharts, config.userPrompt);
    } else {
      aiResponse = await analyzeWithClaude(settings, config.aiConfig, successfulCharts, config.userPrompt);
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
    if (config.webhook?.enabled && config.webhook?.url) {
      webhookResult = await forwardToWebhook(config.webhook, aiResponse);
    }
    
    res.json({
      success: true,
      workflow: workflow.name,
      analysis: aiResponse,
      webhook: webhookResult
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get execution history
app.get('/api/executions', async (req, res) => {
  try {
    const executions = await readJSON(EXECUTIONS_FILE);
    res.json(executions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

// Start server
await ensureDataDir();
app.listen(PORT, () => {
  console.log(`🤖 AI Trade Workflow server running on port ${PORT}`);
});
