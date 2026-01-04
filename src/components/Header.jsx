import React from 'react';
import { Menu, Bell, User } from 'lucide-react';

export default function Header({ sidebarOpen, setSidebarOpen, view, selectedWorkflow }) {
  const getTitle = () => {
    switch (view) {
      case 'workflows': return 'Workflows';
      case 'editor': return selectedWorkflow ? `Edit: ${selectedWorkflow.name}` : 'New Workflow';
      case 'execution': return 'Execution Monitor';
      case 'settings': return 'Settings';
      default: return 'AI Trade Workflow';
    }
  };

  return (
    <header className="h-16 border-b border-terminal-border bg-terminal-bg/50 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-display font-semibold text-white">{getTitle()}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">System Ready</span>
        </div>
      </div>
    </header>
  );
}
