import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Edit, Trash2, MoreVertical, Clock,
  BarChart3, Bot, TrendingUp, TrendingDown, Minus,
  Copy, Plus, Download, Upload, Share2, X, Tag, User
} from 'lucide-react';

export default function WorkflowList({ onEdit, onRun, onNew }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishingWorkflow, setPublishingWorkflow] = useState(null);
  const [importError, setImportError] = useState('');
  const [publishForm, setPublishForm] = useState({ name: '', description: '', author: '', tags: '' });
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
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workflow,
          id: undefined,
          name: `${workflow.name} (Copy)`,
          createdAt: undefined,
          updatedAt: undefined
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
      setShowImportModal(false);
      setImportError('');
    } catch (err) {
      setImportError(err.message || 'Failed to import workflow');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePublishClick = (workflow) => {
    setPublishingWorkflow(workflow);
    setPublishForm({
      name: workflow.name,
      description: '',
      author: '',
      tags: ''
    });
    setShowPublishModal(true);
    setOpenMenu(null);
  };

  const handlePublish = async () => {
    if (!publishingWorkflow) return;

    try {
      const res = await fetch('/api/community/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: publishingWorkflow.id,
          name: publishForm.name,
          description: publishForm.description,
          author: publishForm.author || 'Anonymous',
          tags: publishForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Publish failed');
      }

      setShowPublishModal(false);
      setPublishingWorkflow(null);
      alert('Workflow published to community!');
    } catch (err) {
      alert('Failed to publish: ' + err.message);
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
                <div className="absolute right-0 mt-1 w-44 py-1 bg-terminal-card border border-terminal-border rounded-lg shadow-xl z-20">
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePublishClick(workflow);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" /> Share to Community
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
                workflow.aiProvider === 'openai' 
                  ? 'bg-emerald-500/20 border border-emerald-500/30' 
                  : 'bg-orange-500/20 border border-orange-500/30'
              }`}>
                <Bot className={`w-6 h-6 ${
                  workflow.aiProvider === 'openai' ? 'text-emerald-400' : 'text-orange-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white truncate">{workflow.name}</h4>
                <p className="text-sm text-slate-400">{workflow.symbol || 'No symbol'}</p>
              </div>
            </div>

            {/* Timeframes */}
            <div className="flex flex-wrap gap-2 mb-4">
              {workflow.highTimeframe?.interval && (
                <span className="px-2 py-1 text-xs font-mono bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                  HTF: {workflow.highTimeframe.interval}
                </span>
              )}
              {workflow.midTimeframe?.enabled && workflow.midTimeframe?.interval && (
                <span className="px-2 py-1 text-xs font-mono bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                  MTF: {workflow.midTimeframe.interval}
                </span>
              )}
              {workflow.lowTimeframe?.interval && (
                <span className="px-2 py-1 text-xs font-mono bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                  LTF: {workflow.lowTimeframe.interval}
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-terminal-border">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                {new Date(workflow.updatedAt).toLocaleDateString()}
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

      {/* Publish Modal */}
      <AnimatePresence>
        {showPublishModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPublishModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-terminal-bg border border-terminal-border rounded-xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-display font-semibold text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-400" />
                  Share to Community
                </h3>
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Workflow Name</label>
                  <input
                    type="text"
                    value={publishForm.name}
                    onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })}
                    className="input w-full"
                    placeholder="My Awesome Workflow"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Description</label>
                  <textarea
                    value={publishForm.description}
                    onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                    className="input w-full h-24 resize-none"
                    placeholder="Describe what this workflow does..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Author (optional)
                  </label>
                  <input
                    type="text"
                    value={publishForm.author}
                    onChange={(e) => setPublishForm({ ...publishForm, author: e.target.value })}
                    className="input w-full"
                    placeholder="Your name or anonymous"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={publishForm.tags}
                    onChange={(e) => setPublishForm({ ...publishForm, tags: e.target.value })}
                    className="input w-full"
                    placeholder="macd, trend, scalping"
                  />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300">
                  Your workflow will be shared publicly. API keys and sensitive data are automatically removed.
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePublish}
                    className="btn btn-primary flex-1"
                    disabled={!publishForm.name}
                  >
                    <Share2 className="w-4 h-4" />
                    Publish
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
