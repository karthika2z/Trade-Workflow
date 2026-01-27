import express from 'express';

const router = express.Router();

const API_DOCS = {
  title: 'ChartFlow API Documentation',
  version: '1.0.0',
  baseUrl: '/api',
  description: 'API for executing trading chart analysis workflows',

  endpoints: [
    {
      method: 'POST',
      path: '/api/executions/run/{workflowId}',
      name: 'Execute Workflow (JSON)',
      description: 'Execute a workflow and receive results as a single JSON response. Best for automation and external integrations.',
      parameters: {
        path: {
          workflowId: {
            type: 'string',
            required: true,
            description: 'The unique identifier of the workflow to execute'
          }
        },
        query: {
          includeImages: {
            type: 'boolean',
            required: false,
            default: false,
            description: 'Set to "true" to include base64 chart images in the response'
          }
        },
        body: {
          symbol: {
            type: 'string',
            required: false,
            description: 'Override the default trading symbol (e.g., "BINANCE:BTCUSDT")'
          },
          highTimeframe: {
            type: 'object',
            required: false,
            description: 'Override high timeframe settings',
            properties: {
              interval: 'Timeframe interval (e.g., "D", "W", "4h")',
              indicators: 'Array of indicator names',
              resolution: 'Chart resolution (e.g., "1920x1080", "800x600", "600x1200")'
            }
          },
          midTimeframe: {
            type: 'object',
            required: false,
            description: 'Override mid timeframe settings',
            properties: {
              enabled: 'Boolean to enable/disable',
              interval: 'Timeframe interval',
              indicators: 'Array of indicator names',
              resolution: 'Chart resolution (e.g., "1920x1080", "800x600", "600x1200")'
            }
          },
          lowTimeframe: {
            type: 'object',
            required: false,
            description: 'Override low timeframe settings',
            properties: {
              interval: 'Timeframe interval',
              indicators: 'Array of indicator names',
              resolution: 'Chart resolution (e.g., "1920x1080", "800x600", "600x1200")'
            }
          }
        }
      },
      response: {
        success: {
          type: 'object',
          properties: {
            success: 'boolean - true if execution completed',
            workflow: 'string - workflow name',
            symbol: 'string - trading symbol analyzed',
            analysis: 'object|string - AI analysis result',
            charts: 'array - chart data with labels and images',
            webhook: 'object|null - webhook response if configured'
          }
        },
        error: {
          type: 'object',
          properties: {
            error: 'string - error message',
            message: 'string - detailed error description'
          }
        }
      },
      examples: {
        basic: {
          description: 'Execute workflow with default settings',
          request: {
            method: 'POST',
            url: '/api/run/abc123',
            body: {}
          }
        },
        withOverrides: {
          description: 'Execute workflow with symbol override',
          request: {
            method: 'POST',
            url: '/api/run/abc123',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              symbol: 'BINANCE:ETHUSDT'
            }
          }
        }
      }
    },
    {
      method: 'POST',
      path: '/api/execute/{workflowId}',
      name: 'Execute Workflow (SSE Stream)',
      description: 'Execute a workflow with real-time progress updates via Server-Sent Events. Best for UI integration.',
      parameters: {
        path: {
          workflowId: {
            type: 'string',
            required: true,
            description: 'The unique identifier of the workflow to execute'
          }
        },
        body: {
          symbol: { type: 'string', required: false, description: 'Override trading symbol' },
          highTimeframe: { type: 'object', required: false, description: 'Override high timeframe' },
          midTimeframe: { type: 'object', required: false, description: 'Override mid timeframe' },
          lowTimeframe: { type: 'object', required: false, description: 'Override low timeframe' }
        }
      },
      response: {
        contentType: 'text/event-stream',
        format: 'Each event is a JSON object with: step, status, data, timestamp',
        steps: [
          { step: 'init', description: 'Workflow initialization' },
          { step: 'api_keys', description: 'API key validation' },
          { step: 'charts', description: 'Chart fetching progress' },
          { step: 'analysis', description: 'AI analysis progress' },
          { step: 'webhook', description: 'Webhook delivery (if configured)' },
          { step: 'complete', description: 'Execution complete' }
        ],
        statuses: ['running', 'completed', 'failed', 'warning', 'skipped']
      }
    },
    {
      method: 'GET',
      path: '/api/workflows',
      name: 'List Workflows',
      description: 'Get all configured workflows',
      response: {
        type: 'array',
        items: 'Workflow objects with id, name, symbol, timeframes, and AI configuration'
      }
    },
    {
      method: 'GET',
      path: '/api/executions',
      name: 'List Executions',
      description: 'Get recent workflow execution history',
      response: {
        type: 'array',
        items: 'Execution records with workflow info, results, and timestamps'
      }
    }
  ]
};

// JSON API docs
router.get('/json', (req, res) => {
  res.json(API_DOCS);
});

// HTML API docs
router.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChartFlow API Documentation</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #f8fafc; margin-bottom: 0.5rem; }
    h2 { color: #94a3b8; font-size: 1rem; font-weight: normal; margin-bottom: 2rem; }
    h3 { color: #f8fafc; margin: 2rem 0 1rem; padding-top: 1rem; border-top: 1px solid #334155; }
    .endpoint { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .endpoint-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .method { background: #3b82f6; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-weight: 600; font-size: 0.875rem; }
    .method.get { background: #22c55e; }
    .path { font-family: 'Monaco', 'Menlo', monospace; color: #fbbf24; font-size: 1rem; }
    .description { color: #94a3b8; margin-bottom: 1rem; }
    .section-title { color: #cbd5e1; font-size: 0.875rem; font-weight: 600; margin: 1rem 0 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; }
    td { font-size: 0.875rem; }
    .type { color: #a78bfa; font-family: monospace; }
    .required { color: #f87171; font-size: 0.75rem; }
    code { background: #334155; padding: 0.125rem 0.375rem; border-radius: 3px; font-size: 0.875rem; }
    pre { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 1rem; overflow-x: auto; margin: 0.5rem 0; }
    pre code { background: none; padding: 0; }
    .example { margin-top: 1rem; }
    .example-title { color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .steps { display: grid; gap: 0.5rem; }
    .step { display: flex; gap: 1rem; align-items: center; }
    .step-name { font-family: monospace; color: #fbbf24; min-width: 100px; }
    a { color: #60a5fa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>ChartFlow API</h1>
    <h2>Execute trading chart analysis workflows programmatically</h2>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">POST</span>
        <span class="path">/api/executions/run/{workflowId}</span>
      </div>
      <div class="description">
        <strong>Execute Workflow (JSON Response)</strong><br>
        Execute a workflow and receive results as a single JSON response. Best for automation, webhooks, and external integrations.
      </div>

      <div class="section-title">Path Parameters</div>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td>workflowId</td><td class="type">string</td><td>The unique identifier of the workflow <span class="required">required</span></td></tr>
      </table>

      <div class="section-title">Query Parameters</div>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td>includeImages</td><td class="type">boolean</td><td>Set to <code>true</code> to include base64 chart images in response (default: false)</td></tr>
      </table>

      <div class="section-title">Request Body (Optional Overrides)</div>
      <table>
        <tr><th>Field</th><th>Type</th><th>Description</th></tr>
        <tr><td>symbol</td><td class="type">string</td><td>Override the trading symbol (e.g., <code>BINANCE:ETHUSDT</code>)</td></tr>
        <tr><td>highTimeframe</td><td class="type">object</td><td>Override high timeframe: <code>{ interval, indicators, resolution }</code></td></tr>
        <tr><td>midTimeframe</td><td class="type">object</td><td>Override mid timeframe: <code>{ enabled, interval, indicators, resolution }</code></td></tr>
        <tr><td>lowTimeframe</td><td class="type">object</td><td>Override low timeframe: <code>{ interval, indicators, resolution }</code></td></tr>
      </table>

      <div class="section-title">Example Request</div>
      <pre><code>curl -X POST "https://your-app.run.app/api/executions/run/YOUR_WORKFLOW_ID" \\
  -H "Content-Type: application/json" \\
  -d '{"symbol": "BINANCE:ETHUSDT"}'</code></pre>

      <div class="section-title">Example with Images</div>
      <pre><code>curl -X POST "https://your-app.run.app/api/executions/run/YOUR_WORKFLOW_ID?includeImages=true" \\
  -H "Content-Type: application/json" \\
  -d '{}'</code></pre>

      <div class="section-title">Success Response</div>
      <pre><code>{
  "success": true,
  "workflow": "BTC Daily Analysis",
  "symbol": "BINANCE:BTCUSDT",
  "analysis": {
    "bias": "bullish",
    "confidence": 0.75,
    "key_levels": { ... }
  },
  "charts": [
    { "label": "High Timeframe", "interval": "D" },
    { "label": "Low Timeframe", "interval": "15" }
  ],
  "webhook": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}</code></pre>
      <p style="color: #64748b; font-size: 0.8rem; margin-top: 0.5rem;">Note: Chart images are excluded by default. Add <code>?includeImages=true</code> to include base64 image data.</p>

      <div class="section-title">Error Response</div>
      <pre><code>{
  "error": "Workflow not found"
}</code></pre>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">POST</span>
        <span class="path">/api/execute/{workflowId}</span>
      </div>
      <div class="description">
        <strong>Execute Workflow (SSE Stream)</strong><br>
        Execute a workflow with real-time progress updates via Server-Sent Events. Best for UI integration.
      </div>

      <div class="section-title">Response Format</div>
      <p style="color: #94a3b8; margin-bottom: 1rem;">Returns <code>text/event-stream</code> with JSON events:</p>
      <pre><code>data: {"step":"charts","status":"running","data":{"message":"Fetching High Timeframe chart..."},"timestamp":1704500000000}

data: {"step":"charts","status":"completed","data":{"message":"Fetched 3 charts","charts":[...]},"timestamp":1704500001000}</code></pre>

      <div class="section-title">Execution Steps</div>
      <div class="steps">
        <div class="step"><span class="step-name">init</span> Workflow initialization</div>
        <div class="step"><span class="step-name">api_keys</span> API key validation</div>
        <div class="step"><span class="step-name">charts</span> Chart image fetching</div>
        <div class="step"><span class="step-name">analysis</span> AI analysis</div>
        <div class="step"><span class="step-name">webhook</span> Webhook delivery (if configured)</div>
        <div class="step"><span class="step-name">complete</span> Execution complete</div>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method get">GET</span>
        <span class="path">/api/workflows</span>
      </div>
      <div class="description">List all configured workflows. Returns an array of workflow objects.</div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method get">GET</span>
        <span class="path">/api/executions</span>
      </div>
      <div class="description">Get recent workflow execution history.</div>
    </div>

    <h3>Timeframe Intervals</h3>
    <table>
      <tr><th>Input</th><th>Normalized</th><th>Description</th></tr>
      <tr><td><code>1</code>, <code>1m</code></td><td>1</td><td>1 minute</td></tr>
      <tr><td><code>5</code>, <code>5m</code></td><td>5</td><td>5 minutes</td></tr>
      <tr><td><code>15</code>, <code>15m</code></td><td>15</td><td>15 minutes</td></tr>
      <tr><td><code>60</code>, <code>1h</code></td><td>60</td><td>1 hour</td></tr>
      <tr><td><code>240</code>, <code>4h</code></td><td>240</td><td>4 hours</td></tr>
      <tr><td><code>D</code>, <code>1D</code></td><td>D</td><td>Daily</td></tr>
      <tr><td><code>W</code>, <code>1W</code></td><td>W</td><td>Weekly</td></tr>
      <tr><td><code>M</code>, <code>1M</code></td><td>M</td><td>Monthly</td></tr>
    </table>

    <h3>Chart Resolutions</h3>
    <table>
      <tr><th>Resolution</th><th>Dimensions</th><th>Best For</th></tr>
      <tr><td><code>1920x1080</code></td><td>1920×1080</td><td>Full history view with maximum detail (default)</td></tr>
      <tr><td><code>800x600</code></td><td>800×600</td><td>Classic aspect ratio with history</td></tr>
      <tr><td><code>600x800</code></td><td>600×800</td><td>Balanced mobile portrait view</td></tr>
      <tr><td><code>600x1200</code></td><td>600×1200</td><td>Emphasizes current price action (vertical mobile view)</td></tr>
    </table>

    <p style="margin-top: 2rem; color: #64748b; font-size: 0.875rem;">
      API Documentation v1.0.0 | <a href="/api/docs/json">View as JSON</a>
    </p>
  </div>
</body>
</html>
  `;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
