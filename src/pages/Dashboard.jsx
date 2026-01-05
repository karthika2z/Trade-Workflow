import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow, Settings, Play, Plus, Bot
} from 'lucide-react';
import WorkflowList from '../components/WorkflowList';
import WorkflowEditor from '../components/WorkflowEditor';
import ExecutionView from '../components/ExecutionView';
import SettingsPanel from '../components/SettingsPanel';
import Header from '../components/Header';

function Dashboard() {
  const [view, setView] = useState('workflows'); // workflows, editor, execution, settings
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [executionState, setExecutionState] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleNewWorkflow = () => {
    setSelectedWorkflow(null);
    setView('editor');
  };

  const handleEditWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setView('editor');
  };

  const handleRunWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setExecutionState({ workflow, status: 'pending' });
    setView('execution');
  };

  const handleSaveWorkflow = () => {
    setView('workflows');
    setSelectedWorkflow(null);
  };

  return (
    <div className="min-h-screen bg-terminal-bg bg-grid">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex h-screen">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-64 border-r border-terminal-border bg-terminal-bg/80 backdrop-blur-xl flex flex-col"
            >
              {/* Logo */}
              <div className="p-6 border-b border-terminal-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-lg text-white">AI Trade Workflow</h1>
                    <p className="text-xs text-slate-500">Technical Analysis</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 p-4 space-y-2">
                <NavItem
                  icon={<Workflow className="w-5 h-5" />}
                  label="Workflows"
                  active={view === 'workflows' || view === 'editor'}
                  onClick={() => setView('workflows')}
                />
                <NavItem
                  icon={<Play className="w-5 h-5" />}
                  label="Executions"
                  active={view === 'execution'}
                  onClick={() => setView('execution')}
                />
                <NavItem
                  icon={<Settings className="w-5 h-5" />}
                  label="Settings"
                  active={view === 'settings'}
                  onClick={() => setView('settings')}
                />
              </nav>

              {/* Quick Actions */}
              <div className="p-4 border-t border-terminal-border">
                <button
                  onClick={handleNewWorkflow}
                  className="w-full btn btn-primary justify-center"
                >
                  <Plus className="w-4 h-4" />
                  New Workflow
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            view={view}
            selectedWorkflow={selectedWorkflow}
          />

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              {view === 'workflows' && (
                <motion.div
                  key="workflows"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <WorkflowList
                    onEdit={handleEditWorkflow}
                    onRun={handleRunWorkflow}
                    onNew={handleNewWorkflow}
                  />
                </motion.div>
              )}

              {view === 'editor' && (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <WorkflowEditor
                    workflow={selectedWorkflow}
                    onSave={handleSaveWorkflow}
                    onCancel={() => setView('workflows')}
                    onRun={handleRunWorkflow}
                    onNavigateToSettings={() => setView('settings')}
                  />
                </motion.div>
              )}

              {view === 'execution' && (
                <motion.div
                  key="execution"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <ExecutionView
                    workflow={selectedWorkflow}
                    executionState={executionState}
                  />
                </motion.div>
              )}

              {view === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <SettingsPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        active
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {badge && (
        <span className="ml-auto px-2 py-0.5 text-xs bg-blue-600 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

export default Dashboard;
