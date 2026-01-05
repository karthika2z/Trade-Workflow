import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env') });

// Import routes
import workflowRoutes from './routes/workflows.js';
import executionRoutes from './routes/executions.js';
import settingsRoutes from './routes/settings.js';

// Initialize file storage (creates data directory if needed)
import { getMaskedConfig } from './storage/fileStorage.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

app.use(helmet({
  contentSecurityPolicy: false, // Allow for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// ============================================================================
// GENERAL MIDDLEWARE
// ============================================================================

// JSON parsing for all routes
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

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  const maskedConfig = getMaskedConfig();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: maskedConfig.has_openai_key,
      anthropic: maskedConfig.has_anthropic_key,
      tradingview: maskedConfig.has_tradingview_key
    }
  });
});

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/workflows', workflowRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/execute', executionRoutes); // Alias for backward compatibility
app.use('/api/run', executionRoutes); // Alias for API triggering
app.use('/api/settings', settingsRoutes);

// ============================================================================
// SERVE STATIC FILES (PRODUCTION)
// ============================================================================

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));

  // Catch-all route to serve index.html for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  const maskedConfig = getMaskedConfig();

  console.log('');
  console.log('='.repeat(60));
  console.log('  AI Trade Workflow - Technical Analysis Automation');
  console.log('='.repeat(60));
  console.log(`  Server:      http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('  API Endpoints:');
  console.log('  - GET  /api/workflows         List all workflows');
  console.log('  - POST /api/workflows         Create workflow');
  console.log('  - GET  /api/execute/:id       Execute workflow (SSE)');
  console.log('  - POST /api/run/:id           Execute workflow (JSON)');
  console.log('  - GET  /api/settings          Get API keys');
  console.log('  - PUT  /api/settings          Update API keys');
  console.log('');
  console.log('  API Keys Status:');
  console.log(`  - OpenAI:      ${maskedConfig.has_openai_key ? 'Configured' : 'Not set'}`);
  console.log(`  - Anthropic:   ${maskedConfig.has_anthropic_key ? 'Configured' : 'Not set'}`);
  console.log(`  - TradingView: ${maskedConfig.has_tradingview_key ? 'Configured' : 'Not set'}`);
  console.log('');
  console.log('  Data stored in: ./data/');
  console.log('='.repeat(60));
  console.log('');

  if (!maskedConfig.has_openai_key && !maskedConfig.has_anthropic_key) {
    console.log('Note: Add API keys in Settings to enable AI analysis\n');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  process.exit(0);
});
