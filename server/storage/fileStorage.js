import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '@google-cloud/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GCS_BUCKET = process.env.GCS_BUCKET;
const USE_GCS = !!GCS_BUCKET;

// Local file paths (fallback for development)
const DATA_DIR = path.join(__dirname, '../../data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
const EXECUTIONS_FILE = path.join(DATA_DIR, 'executions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// GCS file names
const GCS_WORKFLOWS = 'workflows.json';
const GCS_EXECUTIONS = 'executions.json';
const GCS_CONFIG = 'config.json';

// GCS client (initialized lazily)
let gcsStorage = null;
let gcsBucket = null;

function getGCSBucket() {
  if (!gcsBucket && USE_GCS) {
    gcsStorage = new Storage();
    gcsBucket = gcsStorage.bucket(GCS_BUCKET);
  }
  return gcsBucket;
}

// In-memory cache for GCS data to reduce reads
const cache = {
  workflows: null,
  executions: null,
  config: null,
  lastFetch: {
    workflows: 0,
    executions: 0,
    config: 0
  }
};

const CACHE_TTL = 5000; // 5 seconds cache TTL

// ============ GCS HELPERS ============

async function readFromGCS(fileName) {
  const bucket = getGCSBucket();
  try {
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  } catch (err) {
    console.error(`Error reading ${fileName} from GCS:`, err.message);
    return null;
  }
}

async function writeToGCS(fileName, data) {
  const bucket = getGCSBucket();
  try {
    const file = bucket.file(fileName);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
      resumable: false
    });
    return true;
  } catch (err) {
    console.error(`Error writing ${fileName} to GCS:`, err.message);
    return false;
  }
}

// ============ GENERIC READ/WRITE ============

async function readData(type) {
  // Check cache first
  const now = Date.now();
  if (cache[type] !== null && (now - cache.lastFetch[type]) < CACHE_TTL) {
    return cache[type];
  }

  let data;

  if (USE_GCS) {
    data = await readFromGCS(getGCSFileName(type));
    if (data === null) {
      data = getDefaultData(type);
      await writeToGCS(getGCSFileName(type), data);
    }
  } else {
    const filePath = getLocalFilePath(type);
    if (!fs.existsSync(filePath)) {
      data = getDefaultData(type);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } else {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  }

  // Update cache
  cache[type] = data;
  cache.lastFetch[type] = now;

  return data;
}

async function writeData(type, data) {
  // Update cache
  cache[type] = data;
  cache.lastFetch[type] = Date.now();

  if (USE_GCS) {
    return await writeToGCS(getGCSFileName(type), data);
  } else {
    const filePath = getLocalFilePath(type);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  }
}

function getGCSFileName(type) {
  const map = { workflows: GCS_WORKFLOWS, executions: GCS_EXECUTIONS, config: GCS_CONFIG };
  return map[type];
}

function getLocalFilePath(type) {
  const map = { workflows: WORKFLOWS_FILE, executions: EXECUTIONS_FILE, config: CONFIG_FILE };
  return map[type];
}

function getDefaultData(type) {
  if (type === 'config') {
    return {
      openai_api_key: '',
      anthropic_api_key: '',
      tradingview_api_key: ''
    };
  }
  return [];
}

// ============ INITIALIZATION ============

function initializeStorage() {
  if (USE_GCS) {
    console.log(`Using Google Cloud Storage bucket: ${GCS_BUCKET}`);
    return;
  }

  // Local storage initialization
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(WORKFLOWS_FILE)) {
    fs.writeFileSync(WORKFLOWS_FILE, '[]', 'utf8');
  }

  if (!fs.existsSync(EXECUTIONS_FILE)) {
    fs.writeFileSync(EXECUTIONS_FILE, '[]', 'utf8');
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
      openai_api_key: '',
      anthropic_api_key: '',
      tradingview_api_key: ''
    }, null, 2), 'utf8');
  }

  console.log('Using local file storage');
}

// Initialize on module load
initializeStorage();

// ============ WORKFLOWS ============

export async function getWorkflows() {
  return await readData('workflows');
}

export async function getWorkflowById(id) {
  const workflows = await getWorkflows();
  return workflows.find(w => w.id === id) || null;
}

export async function createWorkflow(workflowData) {
  const workflows = await getWorkflows();
  const newWorkflow = {
    id: uuidv4(),
    ...workflowData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  workflows.push(newWorkflow);
  await writeData('workflows', workflows);
  return newWorkflow;
}

export async function updateWorkflow(id, updates) {
  const workflows = await getWorkflows();
  const index = workflows.findIndex(w => w.id === id);
  if (index === -1) return null;

  workflows[index] = {
    ...workflows[index],
    ...updates,
    id, // Ensure ID doesn't change
    updated_at: new Date().toISOString()
  };
  await writeData('workflows', workflows);
  return workflows[index];
}

export async function deleteWorkflow(id) {
  const workflows = await getWorkflows();
  const index = workflows.findIndex(w => w.id === id);
  if (index === -1) return false;

  workflows.splice(index, 1);
  await writeData('workflows', workflows);
  return true;
}

// ============ EXECUTIONS ============

export async function getExecutions(limit = 50) {
  const executions = await readData('executions');
  // Return most recent first, limited
  return executions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

export async function getExecutionById(id) {
  const executions = await readData('executions');
  return executions.find(e => e.id === id) || null;
}

export async function createExecution(executionData) {
  const executions = await readData('executions');
  const newExecution = {
    id: uuidv4(),
    ...executionData,
    created_at: new Date().toISOString()
  };
  executions.push(newExecution);

  // Keep only last 100 executions to avoid unbounded growth
  const trimmed = executions.slice(-100);
  await writeData('executions', trimmed);
  return newExecution;
}

export async function updateExecution(id, updates) {
  const executions = await readData('executions');
  const index = executions.findIndex(e => e.id === id);
  if (index === -1) return null;

  executions[index] = {
    ...executions[index],
    ...updates
  };
  await writeData('executions', executions);
  return executions[index];
}

// ============ CONFIG ============

export async function getConfig() {
  return await readData('config');
}

export async function updateConfig(updates) {
  const config = await getConfig();
  const newConfig = { ...config, ...updates };
  await writeData('config', newConfig);
  return newConfig;
}

export async function getApiKey(provider) {
  const config = await getConfig();
  const keyMap = {
    openai: 'openai_api_key',
    anthropic: 'anthropic_api_key',
    tradingview: 'tradingview_api_key'
  };
  return config[keyMap[provider]] || '';
}

// Mask API key for display (show last 4 characters)
function maskApiKey(key) {
  if (!key || key.length < 8) return '';
  return '••••••••' + key.slice(-4);
}

export async function getMaskedConfig() {
  const config = await getConfig();
  return {
    openai_api_key: maskApiKey(config.openai_api_key),
    anthropic_api_key: maskApiKey(config.anthropic_api_key),
    tradingview_api_key: maskApiKey(config.tradingview_api_key),
    // Include flags for whether keys are set
    has_openai_key: !!config.openai_api_key,
    has_anthropic_key: !!config.anthropic_api_key,
    has_tradingview_key: !!config.tradingview_api_key
  };
}

export { initializeStorage };
