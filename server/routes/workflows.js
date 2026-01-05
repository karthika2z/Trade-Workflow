import express from 'express';
import {
  getWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow
} from '../storage/fileStorage.js';

const router = express.Router();

/**
 * GET /api/workflows
 * Get all workflows
 */
router.get('/', async (req, res) => {
  try {
    const workflows = await getWorkflows();
    res.json(workflows);
  } catch (err) {
    console.error('Get workflows error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workflows/:id
 * Get a single workflow by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
  } catch (err) {
    console.error('Get workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', async (req, res) => {
  try {
    const { name, symbol, highTimeframe, midTimeframe, lowTimeframe, aiProvider, aiConfig, userPrompt, webhook } = req.body;

    // Validate required fields
    if (!name || !symbol || !highTimeframe || !lowTimeframe || !aiProvider || !aiConfig) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'symbol', 'highTimeframe', 'lowTimeframe', 'aiProvider', 'aiConfig']
      });
    }

    // Check for duplicate name
    const existingWorkflows = await getWorkflows();
    if (existingWorkflows.some(w => w.name === name)) {
      return res.status(409).json({
        error: 'Workflow name already exists',
        message: 'A workflow with this name already exists. Please choose a different name.'
      });
    }

    const workflowData = {
      name,
      symbol,
      high_timeframe: highTimeframe,
      mid_timeframe: midTimeframe || null,
      low_timeframe: lowTimeframe,
      ai_provider: aiProvider,
      ai_config: aiConfig,
      user_prompt: userPrompt || null,
      webhook: webhook || null
    };

    const newWorkflow = await createWorkflow(workflowData);
    res.status(201).json(newWorkflow);
  } catch (err) {
    console.error('Create workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/workflows/:id
 * Update an existing workflow
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, symbol, highTimeframe, midTimeframe, lowTimeframe, aiProvider, aiConfig, userPrompt, webhook } = req.body;

    // Check if workflow exists
    const existing = await getWorkflowById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Check for duplicate name (excluding current workflow)
    if (name && name !== existing.name) {
      const allWorkflows = await getWorkflows();
      if (allWorkflows.some(w => w.name === name && w.id !== req.params.id)) {
        return res.status(409).json({
          error: 'Workflow name already exists',
          message: 'A workflow with this name already exists. Please choose a different name.'
        });
      }
    }

    const updateData = {
      ...(name && { name }),
      ...(symbol && { symbol }),
      ...(highTimeframe && { high_timeframe: highTimeframe }),
      ...(midTimeframe !== undefined && { mid_timeframe: midTimeframe }),
      ...(lowTimeframe && { low_timeframe: lowTimeframe }),
      ...(aiProvider && { ai_provider: aiProvider }),
      ...(aiConfig && { ai_config: aiConfig }),
      ...(userPrompt !== undefined && { user_prompt: userPrompt }),
      ...(webhook !== undefined && { webhook })
    };

    const updatedWorkflow = await updateWorkflow(req.params.id, updateData);
    res.json(updatedWorkflow);
  } catch (err) {
    console.error('Update workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/workflows/:id
 * Delete a workflow
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteWorkflow(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({ success: true, message: 'Workflow deleted successfully' });
  } catch (err) {
    console.error('Delete workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workflows/:id/export
 * Export a workflow as JSON
 */
router.get('/:id/export', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Sanitize workflow for export
    const exported = {
      name: workflow.name,
      symbol: workflow.symbol,
      highTimeframe: workflow.high_timeframe,
      midTimeframe: workflow.mid_timeframe,
      lowTimeframe: workflow.low_timeframe,
      aiProvider: workflow.ai_provider,
      aiConfig: workflow.ai_config,
      userPrompt: workflow.user_prompt,
      webhook: workflow.webhook,
      _exportedAt: new Date().toISOString(),
      _exportVersion: '2.0'
    };

    res.setHeader('Content-Disposition', `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '-')}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exported);
  } catch (err) {
    console.error('Export workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workflows/import
 * Import a workflow from JSON
 */
router.post('/import', async (req, res) => {
  try {
    const importedWorkflow = req.body;

    // Validate required fields
    if (!importedWorkflow.name || !importedWorkflow.symbol) {
      return res.status(400).json({
        error: 'Invalid workflow',
        message: 'Missing required fields: name or symbol'
      });
    }

    const workflowData = {
      name: importedWorkflow.name + ' (imported)',
      symbol: importedWorkflow.symbol,
      high_timeframe: importedWorkflow.highTimeframe,
      mid_timeframe: importedWorkflow.midTimeframe || null,
      low_timeframe: importedWorkflow.lowTimeframe,
      ai_provider: importedWorkflow.aiProvider,
      ai_config: importedWorkflow.aiConfig,
      user_prompt: importedWorkflow.userPrompt || null,
      webhook: importedWorkflow.webhook || null
    };

    const newWorkflow = await createWorkflow(workflowData);
    res.status(201).json(newWorkflow);
  } catch (err) {
    console.error('Import workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
