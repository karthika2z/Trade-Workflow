import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Download, ThumbsUp, Clock, User, Tag,
  Bot, BarChart3, X, ChevronDown, TrendingUp, Star, Sparkles
} from 'lucide-react';

export default function CommunityBrowser({ onImport }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchCommunityWorkflows();
  }, []);

  const fetchCommunityWorkflows = async () => {
    try {
      const res = await fetch('/api/community/workflows');
      const data = await res.json();
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to fetch community workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/community/vote/${id}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setWorkflows(workflows.map(w => w.id === id ? updated : w));
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleImportFromCommunity = async (workflow) => {
    setImporting(true);
    try {
      const res = await fetch(`/api/community/import/${workflow.id}`, {
        method: 'POST'
      });

      if (!res.ok) {
        throw new Error('Import failed');
      }

      const newWorkflow = await res.json();

      // Update download count locally
      setWorkflows(workflows.map(w =>
        w.id === workflow.id ? { ...w, downloads: w.downloads + 1 } : w
      ));

      setSelectedWorkflow(null);
      onImport?.(newWorkflow);
      alert('Workflow imported successfully!');
    } catch (err) {
      alert('Failed to import workflow: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const filteredWorkflows = workflows
    .filter(w => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        w.name.toLowerCase().includes(term) ||
        w.description?.toLowerCase().includes(term) ||
        w.author?.toLowerCase().includes(term) ||
        w.tags?.some(t => t.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.votes - a.votes;
        case 'downloads':
          return b.downloads - a.downloads;
        case 'recent':
          return new Date(b.publishedAt) - new Date(a.publishedAt);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-display font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            Community Workflows
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Discover and import workflows shared by the community
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 w-64"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input appearance-none pr-8 cursor-pointer"
          >
            <option value="popular">Most Popular</option>
            <option value="downloads">Most Downloaded</option>
            <option value="recent">Most Recent</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filteredWorkflows.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center h-64 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4 border border-purple-500/20">
            <BarChart3 className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="text-lg font-semibold text-white mb-2">
            {searchTerm ? 'No workflows found' : 'No community workflows yet'}
          </h4>
          <p className="text-slate-400 text-sm max-w-md">
            {searchTerm
              ? 'Try adjusting your search terms'
              : 'Be the first to share your workflow with the community!'
            }
          </p>
        </motion.div>
      )}

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkflows.map((workflow, index) => (
          <motion.div
            key={workflow.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card hover:border-purple-500/50 transition-all cursor-pointer"
            onClick={() => setSelectedWorkflow(workflow)}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                workflow.workflow?.aiProvider === 'openai'
                  ? 'bg-emerald-500/20 border border-emerald-500/30'
                  : 'bg-orange-500/20 border border-orange-500/30'
              }`}>
                <Bot className={`w-5 h-5 ${
                  workflow.workflow?.aiProvider === 'openai' ? 'text-emerald-400' : 'text-orange-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white truncate">{workflow.name}</h4>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {workflow.author || 'Anonymous'}
                </p>
              </div>
            </div>

            {/* Description */}
            {workflow.description && (
              <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                {workflow.description}
              </p>
            )}

            {/* Tags */}
            {workflow.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {workflow.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {workflow.tags.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-slate-500">
                    +{workflow.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center justify-between pt-3 border-t border-terminal-border">
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <button
                  onClick={(e) => handleVote(workflow.id, e)}
                  className="flex items-center gap-1 hover:text-yellow-400 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {workflow.votes || 0}
                </button>
                <span className="flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  {workflow.downloads || 0}
                </span>
              </div>
              <span className="text-xs text-slate-600">
                {new Date(workflow.publishedAt).toLocaleDateString()}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Workflow Detail Modal */}
      <AnimatePresence>
        {selectedWorkflow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedWorkflow(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-terminal-bg border border-terminal-border rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    selectedWorkflow.workflow?.aiProvider === 'openai'
                      ? 'bg-emerald-500/20 border border-emerald-500/30'
                      : 'bg-orange-500/20 border border-orange-500/30'
                  }`}>
                    <Bot className={`w-6 h-6 ${
                      selectedWorkflow.workflow?.aiProvider === 'openai' ? 'text-emerald-400' : 'text-orange-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-semibold text-white">
                      {selectedWorkflow.name}
                    </h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {selectedWorkflow.author || 'Anonymous'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWorkflow(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Description */}
              {selectedWorkflow.description && (
                <p className="text-slate-400 mb-4">
                  {selectedWorkflow.description}
                </p>
              )}

              {/* Tags */}
              {selectedWorkflow.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedWorkflow.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded border border-blue-500/20"
                    >
                      <Tag className="w-3 h-3 inline mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Workflow Details */}
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4 space-y-3">
                <h4 className="text-sm font-medium text-white mb-2">Configuration</h4>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Symbol:</span>
                    <span className="text-white ml-2">{selectedWorkflow.workflow?.symbol || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Provider:</span>
                    <span className={`ml-2 ${
                      selectedWorkflow.workflow?.aiProvider === 'openai' ? 'text-emerald-400' : 'text-orange-400'
                    }`}>
                      {selectedWorkflow.workflow?.aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'}
                    </span>
                  </div>
                </div>

                {/* Timeframes */}
                <div className="flex flex-wrap gap-2">
                  {selectedWorkflow.workflow?.highTimeframe?.interval && (
                    <span className="px-2 py-1 text-xs font-mono bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                      HTF: {selectedWorkflow.workflow.highTimeframe.interval}
                    </span>
                  )}
                  {selectedWorkflow.workflow?.midTimeframe?.enabled && (
                    <span className="px-2 py-1 text-xs font-mono bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                      MTF: {selectedWorkflow.workflow.midTimeframe.interval}
                    </span>
                  )}
                  {selectedWorkflow.workflow?.lowTimeframe?.interval && (
                    <span className="px-2 py-1 text-xs font-mono bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                      LTF: {selectedWorkflow.workflow.lowTimeframe.interval}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mb-6 text-sm">
                <span className="flex items-center gap-2 text-yellow-400">
                  <ThumbsUp className="w-4 h-4" />
                  {selectedWorkflow.votes || 0} votes
                </span>
                <span className="flex items-center gap-2 text-slate-400">
                  <Download className="w-4 h-4" />
                  {selectedWorkflow.downloads || 0} downloads
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedWorkflow(null)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleImportFromCommunity(selectedWorkflow)}
                  className="btn btn-primary flex-1"
                  disabled={importing}
                >
                  {importing ? (
                    <div className="spinner w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {importing ? 'Importing...' : 'Add to My Workflows'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
