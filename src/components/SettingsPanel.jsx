import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Key, Eye, EyeOff, Save, Check, AlertCircle,
  ExternalLink, Info, Shield, Play, X, Loader2
} from 'lucide-react';

export default function SettingsPanel() {
  const [settings, setSettings] = useState({
    tradingview: { apiKey: '' },
    openai: { apiKey: '', model: '' },
    anthropic: { apiKey: '', model: '' },
    gemini: { apiKey: '', model: '' }
  });
  const [showKeys, setShowKeys] = useState({
    tradingview: false,
    openai: false,
    anthropic: false,
    gemini: false
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState({ openai: null, anthropic: null, gemini: null });
  const [testMessage, setTestMessage] = useState({ openai: '', anthropic: '', gemini: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(prev => ({
        ...prev,
        ...data,
        openai: { apiKey: '', model: '', ...data.openai },
        anthropic: { apiKey: '', model: '', ...data.anthropic },
        gemini: { apiKey: '', model: '', ...data.gemini }
      }));
    } catch (err) {
      setError('Failed to load settings');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateKey = (provider, value) => {
    setSettings(prev => ({ ...prev, [provider]: { ...prev[provider], apiKey: value } }));
  };

  const updateModel = (provider, value) => {
    setSettings(prev => ({ ...prev, [provider]: { ...prev[provider], model: value } }));
    // Reset test status when model changes
    setTestStatus(prev => ({ ...prev, [provider]: null }));
    setTestMessage(prev => ({ ...prev, [provider]: '' }));
  };

  const testModel = async (provider) => {
    setTestStatus(prev => ({ ...prev, [provider]: 'loading' }));
    setTestMessage(prev => ({ ...prev, [provider]: '' }));
    try {
      const res = await fetch('/api/settings/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model: settings[provider]?.model })
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus(prev => ({ ...prev, [provider]: 'success' }));
        setTestMessage(prev => ({ ...prev, [provider]: data.response }));
      } else {
        setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
        setTestMessage(prev => ({ ...prev, [provider]: data.error }));
      }
    } catch (err) {
      setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
      setTestMessage(prev => ({ ...prev, [provider]: err.message }));
    }
  };

  const ModelTestRow = ({ provider, placeholder }) => {
    const hasKey = settings[provider]?.hasKey;
    const status = testStatus[provider];
    const msg = testMessage[provider];

    return (
      <div className="mt-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings[provider]?.model || ''}
            onChange={(e) => updateModel(provider, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-4 py-2.5 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm"
          />
          <button
            onClick={() => testModel(provider)}
            disabled={!hasKey || status === 'loading'}
            title={!hasKey ? 'Save an API key first' : 'Test model'}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            {status === 'loading'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Play className="w-4 h-4" />}
            Test
          </button>
        </div>
        {status === 'success' && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Model OK — got: "{msg}"</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-start gap-2 text-xs text-red-400">
            <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-all">{msg}</span>
          </div>
        )}
      </div>
    );
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

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-200 font-medium">API Keys stored locally</p>
          <p className="text-xs text-blue-300/70 mt-1">
            Keys are saved to data/config.json on your server. Changes take effect immediately.
          </p>
        </div>
      </div>

      {/* TradingView API */}
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
              <h3 className="font-semibold text-white">TradingView Charts</h3>
              <p className="text-sm text-slate-400">Chart image generation API</p>
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
            type={showKeys.tradingview ? 'text' : 'password'}
            value={settings.tradingview?.apiKey || ''}
            onChange={(e) => updateKey('tradingview', e.target.value)}
            placeholder="Enter your TradingView Charts API key"
            className="w-full px-4 py-3 pr-12 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKeys(prev => ({ ...prev, tradingview: !prev.tradingview }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            {showKeys.tradingview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Generates TradingView chart images optimized for AI vision models</span>
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

        <ModelTestRow provider="openai" placeholder="Model ID (default: gpt-4o)" />

        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Supports GPT-4o and other vision-capable models</span>
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

        <ModelTestRow provider="anthropic" placeholder="Model ID (default: claude-sonnet-4-20250514)" />

        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Supports Claude Sonnet 4 and Opus 4 with vision capabilities</span>
          </div>
        </div>
      </motion.div>

      {/* Gemini API */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Key className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Google Gemini</h3>
              <p className="text-sm text-slate-400">Gemini for chart analysis</p>
            </div>
          </div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            Get API Key <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="relative">
          <input
            type={showKeys.gemini ? 'text' : 'password'}
            value={settings.gemini?.apiKey || ''}
            onChange={(e) => updateKey('gemini', e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3 pr-12 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKeys(prev => ({ ...prev, gemini: !prev.gemini }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            {showKeys.gemini ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <ModelTestRow provider="gemini" placeholder="Model ID (default: gemini-2.5-flash)" />

        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Supports Gemini 2.5 Flash and Pro with multimodal capabilities</span>
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
