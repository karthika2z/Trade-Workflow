import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
const EXECUTIONS_FILE = path.join(DATA_DIR, 'executions.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure data directory and files exist
function initializeStorage() {
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
}

// Initialize on module load
initializeStorage();

// ============ WORKFLOWS ============

export function getWorkflows() {
  const data = fs.readFileSync(WORKFLOWS_FILE, 'utf8');
  return JSON.parse(data);
}

export function getWorkflowById(id) {
  const workflows = getWorkflows();
  return workflows.find(w => w.id === id) || null;
}

export function createWorkflow(workflowData) {
  const workflows = getWorkflows();
  const newWorkflow = {
    id: uuidv4(),
    ...workflowData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  workflows.push(newWorkflow);
  fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2), 'utf8');
  return newWorkflow;
}

export function updateWorkflow(id, updates) {
  const workflows = getWorkflows();
  const index = workflows.findIndex(w => w.id === id);
  if (index === -1) return null;

  workflows[index] = {
    ...workflows[index],
    ...updates,
    id, // Ensure ID doesn't change
    updated_at: new Date().toISOString()
  };
  fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2), 'utf8');
  return workflows[index];
}

export function deleteWorkflow(id) {
  const workflows = getWorkflows();
  const index = workflows.findIndex(w => w.id === id);
  if (index === -1) return false;

  workflows.splice(index, 1);
  fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2), 'utf8');
  return true;
}

// ============ EXECUTIONS ============

export function getExecutions(limit = 50) {
  const data = fs.readFileSync(EXECUTIONS_FILE, 'utf8');
  const executions = JSON.parse(data);
  // Return most recent first, limited
  return executions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

export function getExecutionById(id) {
  const data = fs.readFileSync(EXECUTIONS_FILE, 'utf8');
  const executions = JSON.parse(data);
  return executions.find(e => e.id === id) || null;
}

export function createExecution(executionData) {
  const data = fs.readFileSync(EXECUTIONS_FILE, 'utf8');
  const executions = JSON.parse(data);
  const newExecution = {
    id: uuidv4(),
    ...executionData,
    created_at: new Date().toISOString()
  };
  executions.push(newExecution);
  fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify(executions, null, 2), 'utf8');
  return newExecution;
}

export function updateExecution(id, updates) {
  const data = fs.readFileSync(EXECUTIONS_FILE, 'utf8');
  const executions = JSON.parse(data);
  const index = executions.findIndex(e => e.id === id);
  if (index === -1) return null;

  executions[index] = {
    ...executions[index],
    ...updates
  };
  fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify(executions, null, 2), 'utf8');
  return executions[index];
}

// ============ CONFIG ============

export function getConfig() {
  const data = fs.readFileSync(CONFIG_FILE, 'utf8');
  return JSON.parse(data);
}

export function updateConfig(updates) {
  const config = getConfig();
  const newConfig = { ...config, ...updates };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8');
  return newConfig;
}

export function getApiKey(provider) {
  const config = getConfig();
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

export function getMaskedConfig() {
  const config = getConfig();
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
