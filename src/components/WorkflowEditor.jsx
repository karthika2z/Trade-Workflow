import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Save, X, Play, ChevronRight, ChevronDown, BarChart3, 
  Bot, Webhook, Image, Settings, Plus, Trash2, Info,
  ArrowRight, Check, AlertCircle
} from 'lucide-react';

const TIMEFRAMES = ['1', '3', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'];
const TIMEFRAME_LABELS = {
  '1': '1 min', '3': '3 min', '5': '5 min', '15': '15 min', 
  '30': '30 min', '60': '1 hour', '120': '2 hour', '240': '4 hour',
  'D': 'Daily', 'W': 'Weekly', 'M': 'Monthly'
};

const COMMON_INDICATORS = [
  { id: 'MACD', name: 'MACD', category: 'Momentum' },
  { id: 'RSI', name: 'RSI', category: 'Momentum' },
  { id: 'BB', name: 'Bollinger Bands', category: 'Volatility' },
  { id: 'EMA', name: 'EMA', category: 'Trend' },
  { id: 'SMA', name: 'SMA', category: 'Trend' },
  { id: 'VWAP', name: 'VWAP', category: 'Volume' },
  { id: 'ATR', name: 'ATR', category: 'Volatility' },
  { id: 'Stochastic', name: 'Stochastic', category: 'Momentum' },
  { id: 'ADX', name: 'ADX', category: 'Trend' },
  { id: 'Ichimoku', name: 'Ichimoku Cloud', category: 'Trend' }
];

// AI Model Configuration
// To add new models: add entry with { id: 'model-id', name: 'Display Name', vision: true/false }
// Models are listed in recommended order (first = default)
const AI_MODELS = {
  openai: [
    { id: 'latest', name: 'Latest (Auto-update)', vision: true },
    { id: 'gpt-4o', name: 'GPT-4o', vision: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', vision: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', vision: true },
    { id: 'o1', name: 'o1 (Reasoning)', vision: true },
    { id: 'o1-mini', name: 'o1 Mini (Reasoning)', vision: false }
  ],
  anthropic: [
    { id: 'latest', name: 'Latest (Auto-update)', vision: true },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', vision: true },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', vision: true },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', vision: true },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', vision: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)', vision: true }
  ]
};

const DEFAULT_WORKFLOW = {
  name: '',
  symbol: 'BINANCE:BTCUSDT',
  highTimeframe: { interval: 'D', indicators: ['MACD'] },
  midTimeframe: { enabled: false, interval: '240', indicators: [] },
  lowTimeframe: { interval: '60', indicators: ['MACD'] },
  aiProvider: 'anthropic',
  aiConfig: {
    model: 'latest',
    systemPrompt: `You are an expert technical analyst. Analyze the provided charts and return a JSON response with your analysis.

Return your analysis in this exact JSON format:
{
  "chart_a_bias": {
    "visual_observation": "Description of MACD relative to zero line",
    "bias_determined": "BULLISH" | "BEARISH" | "NEUTRAL/CHOP"
  },
  "chart_b_setup": {
    "setup_type": "Trend Crossover" | "Divergence" | "None",
    "distance_from_zero": "Sufficient Distance" | "Too Close (Chop)",
    "is_valid": true | false
  },
  "chart_c_trigger": {
    "histogram_action": "Description of color flip or bar behavior",
    "trigger_confirmed": true | false
  },
  "trade_execution": {
    "decision": "EXECUTE LONG" | "EXECUTE SHORT" | "NO TRADE",
    "stop_loss_location": "Technical level for SL",
    "take_profit_guidance": "2.0x Risk Ratio"
  }
}`,
    temperature: 0.3,
    topPEnabled: false,
    topP: 1,
    assistantId: ''
  },
  userPrompt: 'Analyze these charts using the MACD Triple Screen methodology. The first chart is the high timeframe for bias, the second (if present) is the mid timeframe for setup confirmation, and the last is the low timeframe for entry trigger.',
  webhook: {
    enabled: false,
    url: '',
    method: 'POST',
    headers: {},
    bodyTemplate: ''
  }
};

export default function WorkflowEditor({ workflow, onSave, onCancel, onRun }) {
  const [formData, setFormData] = useState(() => {
    if (!workflow) return DEFAULT_WORKFLOW;
    // Deep merge to preserve nested object defaults while using saved values
    return {
      ...DEFAULT_WORKFLOW,
      ...workflow,
      highTimeframe: { ...DEFAULT_WORKFLOW.highTimeframe, ...workflow.highTimeframe },
      midTimeframe: { ...DEFAULT_WORKFLOW.midTimeframe, ...workflow.midTimeframe },
      lowTimeframe: { ...DEFAULT_WORKFLOW.lowTimeframe, ...workflow.lowTimeframe },
      aiConfig: { ...DEFAULT_WORKFLOW.aiConfig, ...workflow.aiConfig },
      webhook: { ...DEFAULT_WORKFLOW.webhook, ...workflow.webhook }
    };
  });
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiKeyStatus, setApiKeyStatus] = useState({ chartImg: false, openai: false, anthropic: false });
  const [apiKeyWarning, setApiKeyWarning] = useState('');

  useEffect(() => {
    if (workflow) {
      // Deep merge to preserve nested object defaults while using saved values
      setFormData({
        ...DEFAULT_WORKFLOW,
        ...workflow,
        highTimeframe: { ...DEFAULT_WORKFLOW.highTimeframe, ...workflow.highTimeframe },
        midTimeframe: { ...DEFAULT_WORKFLOW.midTimeframe, ...workflow.midTimeframe },
        lowTimeframe: { ...DEFAULT_WORKFLOW.lowTimeframe, ...workflow.lowTimeframe },
        aiConfig: { ...DEFAULT_WORKFLOW.aiConfig, ...workflow.aiConfig },
        webhook: { ...DEFAULT_WORKFLOW.webhook, ...workflow.webhook }
      });
    }
    fetchApiKeyStatus();
  }, [workflow]);

  const fetchApiKeyStatus = async () => {
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      setApiKeyStatus({
        chartImg: settings.chartImg?.apiKey && !settings.chartImg.apiKey.includes('••••') ? false : settings.chartImg?.apiKey?.length > 4,
        openai: settings.openai?.apiKey && !settings.openai.apiKey.includes('••••') ? false : settings.openai?.apiKey?.length > 4,
        anthropic: settings.anthropic?.apiKey && !settings.anthropic.apiKey.includes('••••') ? false : settings.anthropic?.apiKey?.length > 4
      });
    } catch (err) {
      console.error('Failed to fetch API key status:', err);
    }
  };

  // Re-validate when API key status or provider changes
  useEffect(() => {
    if (apiKeyStatus.chartImg !== undefined) {
      validate();
    }
  }, [apiKeyStatus, formData.aiProvider]);

  const updateField = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let obj = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const validate = () => {
    const newErrors = {};
    const warnings = [];
    
    if (!formData.name?.trim()) newErrors.name = 'Workflow name is required';
    if (!formData.symbol?.trim()) newErrors.symbol = 'Trading symbol is required';
    if (!formData.highTimeframe?.interval) newErrors.highTimeframe = 'High timeframe is required';
    if (!formData.lowTimeframe?.interval) newErrors.lowTimeframe = 'Low timeframe is required';
    
    // Check API keys
    if (!apiKeyStatus.chartImg) {
      warnings.push('Chart-img.com API key is not configured');
    }
    
    if (formData.aiProvider === 'openai' && !apiKeyStatus.openai) {
      warnings.push('OpenAI API key is not configured');
    }
    
    if (formData.aiProvider === 'anthropic' && !apiKeyStatus.anthropic) {
      warnings.push('Anthropic API key is not configured');
    }
    
    setErrors(newErrors);
    setApiKeyWarning(warnings.join('. '));
    
    return Object.keys(newErrors).length === 0;
  };

  const validateWithWarnings = () => {
    const isValid = validate();
    
    if (apiKeyWarning) {
      const proceed = confirm(`Warning: ${apiKeyWarning}. The workflow will fail to execute without these keys.\n\nDo you want to save anyway?`);
      if (!proceed) return false;
    }
    
    return isValid;
  };

  const handleSave = async () => {
    if (!validateWithWarnings()) return;
    
    setSaving(true);
    try {
      const url = workflow?.id ? `/api/workflows/${workflow.id}` : '/api/workflows';
      const method = workflow?.id ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      onSave();
    } catch (err) {
      console.error('Failed to save workflow:', err);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { id: 'basic', label: 'Basic Info', icon: <Settings className="w-4 h-4" /> },
    { id: 'charts', label: 'Chart Setup', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'ai', label: 'AI Config', icon: <Bot className="w-4 h-4" /> },
    { id: 'webhook', label: 'Webhook', icon: <Webhook className="w-4 h-4" /> }
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 px-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <button
              onClick={() => setActiveStep(index)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeStep === index 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                activeStep > index ? 'bg-emerald-500 text-white' : 
                activeStep === index ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {activeStep > index ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <span className="font-medium hidden sm:inline">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <div className="flex-1 h-px bg-terminal-border mx-2" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* API Key Warning Banner */}
      {apiKeyWarning && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200 font-medium">Missing API Keys</p>
            <p className="text-xs text-amber-300/70 mt-1">{apiKeyWarning}</p>
            <button 
              onClick={() => window.location.hash = 'settings'}
              className="text-xs text-amber-400 hover:text-amber-300 mt-2 underline"
            >
              Go to Settings →
            </button>
          </div>
        </div>
      )}

      {/* Visual Flow Preview */}
      <div className="card mb-6 overflow-x-auto">
        <h4 className="text-sm font-medium text-slate-400 mb-4">Workflow Flow</h4>
        <div className="flex items-center gap-3 min-w-max pb-2">
          {/* Charts Group */}
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-terminal-border bg-slate-800/30">
            <span className="text-xs text-slate-500 text-center mb-1">Step 1: Fetch Charts</span>
            <div className="flex gap-2">
              <FlowNode 
                icon={<Image className="w-4 h-4" />}
                label="HTF"
                sublabel={formData.highTimeframe?.interval ? TIMEFRAME_LABELS[formData.highTimeframe.interval] : '—'}
                color="blue"
                active={formData.highTimeframe?.interval}
                compact
              />
              
              {formData.midTimeframe?.enabled && (
                <FlowNode 
                  icon={<Image className="w-4 h-4" />}
                  label="MTF"
                  sublabel={formData.midTimeframe?.interval ? TIMEFRAME_LABELS[formData.midTimeframe.interval] : '—'}
                  color="purple"
                  active={formData.midTimeframe?.interval}
                  compact
                />
              )}
              
              <FlowNode 
                icon={<Image className="w-4 h-4" />}
                label="LTF"
                sublabel={formData.lowTimeframe?.interval ? TIMEFRAME_LABELS[formData.lowTimeframe.interval] : '—'}
                color="amber"
                active={formData.lowTimeframe?.interval}
                compact
              />
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-slate-600" />
          
          {/* AI Analysis */}
          <div className="p-3 rounded-xl border border-terminal-border bg-slate-800/30">
            <span className="text-xs text-slate-500 text-center block mb-1">Step 2: Analyze</span>
            <FlowNode 
              icon={<Bot className="w-4 h-4" />}
              label="AI"
              sublabel={formData.aiProvider === 'openai' ? 'OpenAI' : 'Claude'}
              color="emerald"
              active={true}
              compact
            />
          </div>
          
          <ArrowRight className="w-5 h-5 text-slate-600" />
          
          {/* Webhook */}
          <div className="p-3 rounded-xl border border-terminal-border bg-slate-800/30">
            <span className="text-xs text-slate-500 text-center block mb-1">Step 3: Forward</span>
            <FlowNode 
              icon={<Webhook className="w-4 h-4" />}
              label="Webhook"
              sublabel={formData.webhook?.enabled ? 'Enabled' : 'Disabled'}
              color={formData.webhook?.enabled ? 'rose' : 'slate'}
              active={formData.webhook?.enabled}
              compact
            />
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="card">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeStep === 0 && (
            <BasicInfoStep 
              formData={formData} 
              updateField={updateField} 
              errors={errors}
            />
          )}
          {activeStep === 1 && (
            <ChartSetupStep 
              formData={formData} 
              updateField={updateField}
              errors={errors}
            />
          )}
          {activeStep === 2 && (
            <AIConfigStep 
              formData={formData} 
              updateField={updateField}
            />
          )}
          {activeStep === 3 && (
            <WebhookStep 
              formData={formData} 
              updateField={updateField}
            />
          )}
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-terminal-border">
          <button
            onClick={onCancel}
            className="btn btn-ghost"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          
          <div className="flex items-center gap-3">
            {activeStep > 0 && (
              <button
                onClick={() => setActiveStep(activeStep - 1)}
                className="btn btn-ghost"
              >
                Previous
              </button>
            )}
            
            {activeStep < steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="btn btn-primary"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? (
                    <div className="spinner" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Workflow
                </button>
                <button
                  onClick={async () => {
                    if (validateWithWarnings()) {
                      setSaving(true);
                      try {
                        const url = workflow?.id ? `/api/workflows/${workflow.id}` : '/api/workflows';
                        const method = workflow?.id ? 'PUT' : 'POST';
                        const res = await fetch(url, {
                          method,
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(formData)
                        });
                        const savedWorkflow = await res.json();
                        onRun(savedWorkflow);
                      } catch (err) {
                        console.error('Failed to save workflow:', err);
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                  className="btn btn-success"
                >
                  <Play className="w-4 h-4" />
                  Save & Run
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowNode({ icon, label, sublabel, color, active, compact }) {
  const colorClasses = {
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    amber: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
    emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    rose: 'bg-rose-500/20 border-rose-500/30 text-rose-400',
    slate: 'bg-slate-500/20 border-slate-500/30 text-slate-400'
  };
  
  if (compact) {
    return (
      <div className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border ${
        active ? colorClasses[color] : 'bg-slate-800/50 border-slate-700 text-slate-500'
      }`}>
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
        <span className="text-[9px] opacity-70">{sublabel}</span>
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border ${
      active ? colorClasses[color] : 'bg-slate-800/50 border-slate-700 text-slate-500'
    }`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px] opacity-70">{sublabel}</span>
    </div>
  );
}

function BasicInfoStep({ formData, updateField, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Basic Information</h3>
        <p className="text-sm text-slate-400">Set up the workflow name and trading pair</p>
      </div>
      
      <div className="grid gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Workflow Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., BTC MACD Triple Screen"
            className={`w-full px-4 py-3 bg-terminal-bg border rounded-lg text-white placeholder-slate-500 ${
              errors.name ? 'border-red-500' : 'border-terminal-border'
            }`}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Trading Symbol *
          </label>
          <input
            type="text"
            value={formData.symbol}
            onChange={(e) => updateField('symbol', e.target.value)}
            placeholder="e.g., BINANCE:BTCUSDT"
            className={`w-full px-4 py-3 bg-terminal-bg border rounded-lg text-white placeholder-slate-500 font-mono ${
              errors.symbol ? 'border-red-500' : 'border-terminal-border'
            }`}
          />
          <p className="text-slate-500 text-xs mt-1.5">
            Format: EXCHANGE:SYMBOL (e.g., BINANCE:BTCUSDT, NASDAQ:AAPL, COINBASE:ETHUSD)
          </p>
          {errors.symbol && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.symbol}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartSetupStep({ formData, updateField, errors }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Chart Configuration</h3>
        <p className="text-sm text-slate-400">Configure your multi-timeframe chart setup</p>
      </div>
      
      {/* High Timeframe */}
      <ChartConfig
        title="High Timeframe (Bias)"
        description="Used to determine overall market bias"
        config={formData.highTimeframe}
        onChange={(config) => updateField('highTimeframe', config)}
        color="blue"
        error={errors.highTimeframe}
      />
      
      {/* Mid Timeframe (Optional) */}
      <div className="border border-terminal-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Image className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">Mid Timeframe (Optional)</h4>
              <p className="text-xs text-slate-400">Secondary confirmation timeframe</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.midTimeframe?.enabled || false}
              onChange={(e) => updateField('midTimeframe', { 
                ...formData.midTimeframe, 
                enabled: e.target.checked 
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        
        {formData.midTimeframe?.enabled && (
          <ChartConfig
            config={formData.midTimeframe}
            onChange={(config) => updateField('midTimeframe', { ...config, enabled: true })}
            color="purple"
            compact
          />
        )}
      </div>
      
      {/* Low Timeframe */}
      <ChartConfig
        title="Low Timeframe (Trigger)"
        description="Used for entry timing and triggers"
        config={formData.lowTimeframe}
        onChange={(config) => updateField('lowTimeframe', config)}
        color="amber"
        error={errors.lowTimeframe}
      />
    </div>
  );
}

function ChartConfig({ title, description, config, onChange, color, compact, error }) {
  const [showIndicators, setShowIndicators] = useState(false);
  
  const colorClasses = {
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    amber: 'bg-amber-500/20 border-amber-500/30 text-amber-400'
  };
  
  const toggleIndicator = (id) => {
    const current = config.indicators || [];
    const updated = current.includes(id) 
      ? current.filter(i => i !== id)
      : [...current, id];
    onChange({ ...config, indicators: updated });
  };

  return (
    <div className={`border border-terminal-border rounded-xl p-4 ${compact ? '' : ''}`}>
      {!compact && (
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
            <Image className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-white">{title}</h4>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
      )}
      
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Timeframe</label>
          <select
            value={config?.interval || ''}
            onChange={(e) => onChange({ ...config, interval: e.target.value })}
            className={`w-full px-4 py-2.5 bg-terminal-bg border rounded-lg text-white appearance-none ${
              error ? 'border-red-500' : 'border-terminal-border'
            }`}
          >
            <option value="">Select timeframe...</option>
            {TIMEFRAMES.map(tf => (
              <option key={tf} value={tf}>{TIMEFRAME_LABELS[tf]}</option>
            ))}
          </select>
          {error && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </div>
        
        <div>
          <button
            type="button"
            onClick={() => setShowIndicators(!showIndicators)}
            className="flex items-center justify-between w-full text-sm font-medium text-slate-300 mb-2"
          >
            <span>Indicators ({config?.indicators?.length || 0})</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showIndicators ? 'rotate-180' : ''}`} />
          </button>
          
          {showIndicators && (
            <div className="flex flex-wrap gap-2 mt-2">
              {COMMON_INDICATORS.map(ind => (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => toggleIndicator(ind.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    config?.indicators?.includes(ind.id)
                      ? colorClasses[color]
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ind.name}
                </button>
              ))}
            </div>
          )}
          
          {(config?.indicators?.length || 0) > 0 && !showIndicators && (
            <div className="flex flex-wrap gap-1.5">
              {config.indicators.map(id => (
                <span key={id} className={`px-2 py-0.5 rounded text-xs ${colorClasses[color]}`}>
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AIConfigStep({ formData, updateField }) {
  const [useAssistant, setUseAssistant] = useState(!!formData.aiConfig?.assistantId);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">AI Configuration</h3>
        <p className="text-sm text-slate-400">Configure the AI assistant for chart analysis</p>
      </div>
      
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">AI Provider</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              updateField('aiProvider', 'anthropic');
              updateField('aiConfig.model', 'latest');
            }}
            className={`p-4 rounded-xl border transition-all ${
              formData.aiProvider === 'anthropic'
                ? 'bg-orange-500/10 border-orange-500/50 text-orange-400'
                : 'bg-terminal-bg border-terminal-border text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                formData.aiProvider === 'anthropic' ? 'bg-orange-500/20' : 'bg-slate-800'
              }`}>
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-medium text-white">Claude</div>
                <div className="text-xs opacity-70">by Anthropic</div>
              </div>
            </div>
          </button>
          
          <button
            type="button"
            onClick={() => {
              updateField('aiProvider', 'openai');
              updateField('aiConfig.model', 'latest');
            }}
            className={`p-4 rounded-xl border transition-all ${
              formData.aiProvider === 'openai'
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                : 'bg-terminal-bg border-terminal-border text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                formData.aiProvider === 'openai' ? 'bg-emerald-500/20' : 'bg-slate-800'
              }`}>
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-medium text-white">GPT-4</div>
                <div className="text-xs opacity-70">by OpenAI</div>
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* OpenAI Assistant Toggle */}
      {formData.aiProvider === 'openai' && (
        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
          <div>
            <div className="font-medium text-white">Use Custom Assistant</div>
            <div className="text-xs text-slate-400">Use a pre-configured OpenAI Assistant</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={useAssistant}
              onChange={(e) => {
                setUseAssistant(e.target.checked);
                if (!e.target.checked) {
                  updateField('aiConfig.assistantId', '');
                }
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      )}
      
      {useAssistant && formData.aiProvider === 'openai' ? (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Assistant ID</label>
          <input
            type="text"
            value={formData.aiConfig?.assistantId || ''}
            onChange={(e) => updateField('aiConfig.assistantId', e.target.value)}
            placeholder="asst_xxxxxxxxxx"
            className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono"
          />
        </div>
      ) : (
        <>
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
            <select
              value={formData.aiConfig?.model || ''}
              onChange={(e) => updateField('aiConfig.model', e.target.value)}
              className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white appearance-none"
            >
              {AI_MODELS[formData.aiProvider]?.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>
          
          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">System Prompt</label>
            <textarea
              value={formData.aiConfig?.systemPrompt || ''}
              onChange={(e) => updateField('aiConfig.systemPrompt', e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm resize-none"
              placeholder="Enter system instructions for the AI..."
            />
          </div>
          
          {/* Temperature & Top P */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Temperature: {formData.aiConfig?.temperature ?? 0.3}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.aiConfig?.temperature ?? 0.3}
                onChange={(e) => updateField('aiConfig.temperature', parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Top P {formData.aiConfig?.topPEnabled ? `: ${formData.aiConfig?.topP ?? 1}` : ''}
                </label>
                <button
                  type="button"
                  onClick={() => updateField('aiConfig.topPEnabled', !formData.aiConfig?.topPEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    formData.aiConfig?.topPEnabled ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      formData.aiConfig?.topPEnabled ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {formData.aiConfig?.topPEnabled ? (
                <>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.aiConfig?.topP ?? 1}
                    onChange={(e) => updateField('aiConfig.topP', parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Focused</span>
                    <span>Diverse</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">Enable to control nucleus sampling (disabled = API default)</p>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* User Prompt */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">User Prompt (sent with charts)</label>
        <textarea
          value={formData.userPrompt || ''}
          onChange={(e) => updateField('userPrompt', e.target.value)}
          rows={4}
          className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 resize-none"
          placeholder="Additional instructions to send with the chart images..."
        />
      </div>
    </div>
  );
}

function WebhookStep({ formData, updateField }) {
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  
  const addHeader = () => {
    if (headerKey && headerValue) {
      const headers = { ...formData.webhook?.headers, [headerKey]: headerValue };
      updateField('webhook.headers', headers);
      setHeaderKey('');
      setHeaderValue('');
    }
  };
  
  const removeHeader = (key) => {
    const headers = { ...formData.webhook?.headers };
    delete headers[key];
    updateField('webhook.headers', headers);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Webhook Configuration</h3>
        <p className="text-sm text-slate-400">Forward AI responses to external trading systems</p>
      </div>
      
      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
        <div>
          <div className="font-medium text-white">Enable Webhook</div>
          <div className="text-xs text-slate-400">Send analysis results to an external API</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.webhook?.enabled || false}
            onChange={(e) => updateField('webhook.enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      {formData.webhook?.enabled && (
        <>
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Webhook URL</label>
            <input
              type="url"
              value={formData.webhook?.url || ''}
              onChange={(e) => updateField('webhook.url', e.target.value)}
              placeholder="https://your-trading-bot.com/webhook"
              className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono"
            />
          </div>
          
          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">HTTP Method</label>
            <select
              value={formData.webhook?.method || 'POST'}
              onChange={(e) => updateField('webhook.method', e.target.value)}
              className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white appearance-none"
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          
          {/* Headers */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Custom Headers</label>
            <div className="space-y-2 mb-3">
              {Object.entries(formData.webhook?.headers || {}).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg">
                  <span className="font-mono text-sm text-blue-400">{key}:</span>
                  <span className="font-mono text-sm text-slate-300 flex-1 truncate">{value}</span>
                  <button
                    type="button"
                    onClick={() => removeHeader(key)}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
                placeholder="Header name"
                className="flex-1 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 text-sm"
              />
              <input
                type="text"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
                placeholder="Header value"
                className="flex-1 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 text-sm"
              />
              <button
                type="button"
                onClick={addHeader}
                className="btn btn-ghost px-3"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Body Template */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Body Template (optional)
            </label>
            <textarea
              value={formData.webhook?.bodyTemplate || ''}
              onChange={(e) => updateField('webhook.bodyTemplate', e.target.value)}
              rows={4}
              placeholder='{"signal": {{response}}, "timestamp": "{{timestamp}}"}'
              className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white placeholder-slate-500 font-mono text-sm resize-none"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Use {'{{response}}'} to insert the AI response. Leave empty to send raw response.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
