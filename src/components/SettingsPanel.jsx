import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, Eye, EyeOff, Save, Check, AlertCircle, 
  ExternalLink, Info, Shield
} from 'lucide-react';

export default function SettingsPanel() {
  const [settings, setSettings] = useState({
    AICharts: { apiKey: '' },
    openai: { apiKey: '' },
    anthropic: { apiKey: '' }
  });
  const [showKeys, setShowKeys] = useState({
    AICharts: false,
    openai: false,
    anthropic: false
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      setError('Failed to load settings');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateKey = (provider, value) => {
    setSettings(prev => ({
      ...prev,
      [provider]: { apiKey: value }
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4 border border-blue-500/20">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white">API Settings</h2>
        <p className="text-slate-400 mt-2">Configure your API keys for chart generation and AI analysis</p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-200 font-medium">API Keys are stored locally</p>
          <p className="text-xs text-amber-300/70 mt-1">
            Keys are stored in a local file on your server. Make sure to secure access to your deployment.
          </p>
        </div>
      </div>

      {/* AICharts API */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Key className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AICharts</h3>
              <p className="text-sm text-slate-400">AI-enhanced TradingView chart API</p>
            </div>
          </div>
          <a
            href="https://tradingview-charts-891341779188.us-central1.run.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            Get API Key <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="relative">
          <input
            type={showKeys.AICharts ? 'text' : 'password'}
            value={settings.AICharts?.apiKey || ''}
            onChange={(e) => updateKey('AICharts', e.target.value)}
            placeholder="Enter your AICharts API key"
            className="w-full px-4 py-3 pr-12 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKeys(prev => ({ ...prev, AICharts: !prev.AICharts }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            {showKeys.AICharts ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>AI-enhanced TradingView charts optimized for vision models (GPT-4V, Claude Vision)</span>
          </div>
        </div>
      </motion.div>

      {/* OpenAI API */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Key className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">OpenAI</h3>
              <p className="text-sm text-slate-400">GPT-4 Vision for chart analysis</p>
            </div>
          </div>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            Get API Key <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        
        <div className="relative">
          <input
            type={showKeys.openai ? 'text' : 'password'}
            value={settings.openai?.apiKey || ''}
            onChange={(e) => updateKey('openai', e.target.value)}
            placeholder="sk-..."
            className="w-full px-4 py-3 pr-12 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            {showKeys.openai ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Supports GPT-4o and custom Assistants with vision capabilities</span>
          </div>
        </div>
      </motion.div>

      {/* Anthropic API */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Key className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Anthropic</h3>
              <p className="text-sm text-slate-400">Claude for chart analysis</p>
            </div>
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            Get API Key <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        
        <div className="relative">
          <input
            type={showKeys.anthropic ? 'text' : 'password'}
            value={settings.anthropic?.apiKey || ''}
            onChange={(e) => updateKey('anthropic', e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-4 py-3 pr-12 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            {showKeys.anthropic ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Supports Claude Sonnet 4 and Opus 4 with vision capabilities</span>
          </div>
        </div>
      </motion.div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4">
        {error && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-emerald-400">
            <Check className="w-4 h-4" />
            <span className="text-sm">Settings saved successfully</span>
          </div>
        )}
        {!error && !saved && <div />}
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? (
            <div className="spinner" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
