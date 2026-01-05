import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Trash2, MoreVertical, Clock,
  BarChart3, Bot,
  Copy, Plus, Download, Upload, X
} from 'lucide-react';

export default function WorkflowList({ onEdit, onRun, onNew }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      setWorkflows(workflows.filter(w => w.id !== id));
    } catch (err) {
      console.error('Failed to delete workflow:', err);
    }
    setOpenMenu(null);
  };

  const handleDuplicate = async (workflow) => {
    try {
      // Map snake_case server fields to camelCase for the API
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${workflow.name} (Copy)`,
          symbol: workflow.symbol,
          highTimeframe: workflow.high_timeframe || workflow.highTimeframe,
          midTimeframe: workflow.mid_timeframe || workflow.midTimeframe,
          lowTimeframe: workflow.low_timeframe || workflow.lowTimeframe,
          aiProvider: workflow.ai_provider || workflow.aiProvider,
          aiConfig: workflow.ai_config || workflow.aiConfig,
          userPrompt: workflow.user_prompt || workflow.userPrompt,
          webhook: workflow.webhook
        })
      });
      const newWorkflow = await res.json();
      setWorkflows([newWorkflow, ...workflows]);
    } catch (err) {
      console.error('Failed to duplicate workflow:', err);
    }
    setOpenMenu(null);
  };

  const handleExport = async (workflow) => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/export`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export workflow:', err);
    }
    setOpenMenu(null);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const workflow = JSON.parse(text);

      const res = await fetch('/api/workflows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Import failed');
      }

      const newWorkflow = await res.json();
      setWorkflows([newWorkflow, ...workflows]);
      setImportError('');
    } catch (err) {
      setImportError(err.message || 'Failed to import workflow');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-96 text-center"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-6 border border-blue-500/20">
          <BarChart3 className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-xl font-display font-semibold text-white mb-2">No workflows yet</h3>
        <p className="text-slate-400 mb-6 max-w-md">
          Create your first AI-powered trading workflow to analyze charts and generate signals automatically.
        </p>
        <button onClick={onNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Create Your First Workflow
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-display font-semibold text-white">Your Workflows</h3>
          <p className="text-slate-400 text-sm mt-1">{workflows.length} workflow{workflows.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button onClick={onNew} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((workflow, index) => (
          <motion.div
            key={workflow.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group card hover:border-blue-500/50 transition-all duration-300 cursor-pointer relative"
            onClick={() => onEdit(workflow)}
          >
            {/* Menu Button */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === workflow.id ? null : workflow.id);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {openMenu === workflow.id && (
                <div className="absolute right-0 mt-1 w-36 py-1 bg-terminal-card border border-terminal-border rounded-lg shadow-xl z-20">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(workflow);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" /> Duplicate
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(workflow);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                  <div className="border-t border-terminal-border my-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(workflow.id);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>

            {/* Card Content */}
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                workflow.ai_provider === 'openai'
                  ? 'bg-emerald-500/20 border border-emerald-500/30'
                  : 'bg-orange-500/20 border border-orange-500/30'
              }`}>
                <Bot className={`w-6 h-6 ${
                  workflow.ai_provider === 'openai' ? 'text-emerald-400' : 'text-orange-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white truncate">{workflow.name}</h4>
                <p className="text-sm text-slate-400">{workflow.symbol || 'No symbol'}</p>
              </div>
            </div>

            {/* Timeframes */}
            <div className="flex flex-wrap gap-2 mb-4">
              {workflow.high_timeframe?.interval && (
                <span className="px-2 py-1 text-xs font-mono bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                  HTF: {workflow.high_timeframe.interval}
                </span>
              )}
              {workflow.mid_timeframe?.enabled && workflow.mid_timeframe?.interval && (
                <span className="px-2 py-1 text-xs font-mono bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                  MTF: {workflow.mid_timeframe.interval}
                </span>
              )}
              {workflow.low_timeframe?.interval && (
                <span className="px-2 py-1 text-xs font-mono bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                  LTF: {workflow.low_timeframe.interval}
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-terminal-border">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                {workflow.updated_at ? new Date(workflow.updated_at).toLocaleDateString() : 'N/A'}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRun(workflow);
                }}
                className="btn btn-success py-1.5 px-3 text-sm"
              >
                <Play className="w-3.5 h-3.5" />
                Run
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Import Error Toast */}
      <AnimatePresence>
        {importError && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3 z-50"
          >
            <span className="text-red-300">{importError}</span>
            <button
              onClick={() => setImportError('')}
              className="text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
