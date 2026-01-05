import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, RotateCcw, Image, Bot, Webhook, Check, 
  X, AlertCircle, Clock, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Minus, ExternalLink, Copy,
  Zap, ArrowRight
} from 'lucide-react';

const STEP_CONFIG = {
  init: { icon: Zap, label: 'Initializing', color: 'blue' },
  charts: { icon: Image, label: 'Fetching Charts', color: 'purple' },
  analysis: { icon: Bot, label: 'AI Analysis', color: 'emerald' },
  webhook: { icon: Webhook, label: 'Webhook', color: 'rose' },
  complete: { icon: Check, label: 'Complete', color: 'emerald' },
  error: { icon: AlertCircle, label: 'Error', color: 'red' }
};

// Collapsible JSON Tree Component
function JsonTree({ data, level = 0, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(level < 2 ? defaultExpanded : false);

  if (data === null) return <span className="text-slate-500">null</span>;
  if (data === undefined) return <span className="text-slate-500">undefined</span>;
  if (typeof data === 'boolean') return <span className="text-amber-400">{data.toString()}</span>;
  if (typeof data === 'number') return <span className="text-blue-400">{data}</span>;
  if (typeof data === 'string') return <span className="text-emerald-400">"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-slate-500">[]</span>;
    return (
      <div className="inline">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center text-slate-400 hover:text-white"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="text-slate-500 ml-1">[{data.length}]</span>
        </button>
        {expanded && (
          <div className="ml-4 border-l border-slate-700 pl-2">
            {data.map((item, idx) => (
              <div key={idx} className="py-0.5">
                <span className="text-slate-500">{idx}: </span>
                <JsonTree data={item} level={level + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span className="text-slate-500">{'{}'}</span>;
    return (
      <div className="inline">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center text-slate-400 hover:text-white"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="text-slate-500 ml-1">{'{'}...{'}'}</span>
        </button>
        {expanded && (
          <div className="ml-4 border-l border-slate-700 pl-2">
            {keys.map((key) => (
              <div key={key} className="py-0.5">
                <span className="text-purple-400">{key}</span>
                <span className="text-slate-500">: </span>
                <JsonTree data={data[key]} level={level + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-slate-400">{String(data)}</span>;
}

// Common trading symbols organized by exchange
const COMMON_SYMBOLS = {
  'BINANCE': ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'],
  'COINBASE': ['BTCUSD', 'ETHUSD', 'SOLUSD'],
  'FX': ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'],
  'INDEX': ['SPX', 'NDX', 'DJI']
};

// Available timeframes for selection (using human-readable API format)
const TIMEFRAMES = [
  { value: '1m', label: '1m' },
  { value: '3m', label: '3m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1H' },
  { value: '2h', label: '2H' },
  { value: '4h', label: '4H' },
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' }
];

// Map TradingView internal format to human-readable format for display
const normalizeIntervalForDisplay = (interval) => {
  const mapping = {
    '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m',
    '60': '1h', '120': '2h', '240': '4h',
    'D': '1D', 'W': '1W', 'M': '1M'
  };
  return mapping[interval] || interval;
};

// Helper to get workflow fields (handles snake_case from server or camelCase)
const getWorkflowField = (wf, field) => {
  if (!wf) return undefined;
  const snakeCase = field.replace(/([A-Z])/g, '_$1').toLowerCase();
  return wf[snakeCase] || wf[field];
};

export default function ExecutionView({ workflow, executionState }) {
  const [steps, setSteps] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflow);
  const [workflows, setWorkflows] = useState([]);
  const [expandedStep, setExpandedStep] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [symbolOverride, setSymbolOverride] = useState('');
  const [htfInterval, setHtfInterval] = useState('');
  const [mtfInterval, setMtfInterval] = useState('');
  const [ltfInterval, setLtfInterval] = useState('');
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchWorkflows();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (workflow) {
      setSelectedWorkflow(workflow);
      syncOverridesFromWorkflow(workflow);
    }
  }, [workflow]);

  // Update overrides when workflow selection changes
  useEffect(() => {
    if (selectedWorkflow) {
      syncOverridesFromWorkflow(selectedWorkflow);
    }
  }, [selectedWorkflow?.id]);

  const syncOverridesFromWorkflow = (wf) => {
    setSymbolOverride(wf.symbol || '');
    // Handle both snake_case (from server) and camelCase field names
    const htf = wf.high_timeframe || wf.highTimeframe;
    const mtf = wf.mid_timeframe || wf.midTimeframe;
    const ltf = wf.low_timeframe || wf.lowTimeframe;
    setHtfInterval(normalizeIntervalForDisplay(htf?.interval || ''));
    setMtfInterval(normalizeIntervalForDisplay(mtf?.interval || ''));
    setLtfInterval(normalizeIntervalForDisplay(ltf?.interval || ''));
  };

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(data);
      if (!selectedWorkflow && data.length > 0) {
        setSelectedWorkflow(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/executions');
      const data = await res.json();
      setExecutionHistory(data.slice(0, 10));
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const runWorkflow = async () => {
    if (!selectedWorkflow) {
      console.error('No workflow selected');
      alert('Please select a workflow first');
      return;
    }
    
    console.log('Starting workflow:', selectedWorkflow.name);
    setIsRunning(true);
    setSteps([]);
    setExpandedStep(null);
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    
    try {
      // Get workflow timeframes (handle snake_case from server)
      const wfHtf = getWorkflowField(selectedWorkflow, 'highTimeframe');
      const wfMtf = getWorkflowField(selectedWorkflow, 'midTimeframe');
      const wfLtf = getWorkflowField(selectedWorkflow, 'lowTimeframe');

      // Build override payload
      const overrides = {};
      if (symbolOverride && symbolOverride !== selectedWorkflow.symbol) {
        overrides.symbol = symbolOverride;
      }
      // Add timeframe overrides if changed
      if (htfInterval && htfInterval !== normalizeIntervalForDisplay(wfHtf?.interval)) {
        overrides.highTimeframe = {
          ...wfHtf,
          interval: htfInterval
        };
      }
      if (wfMtf?.enabled && mtfInterval && mtfInterval !== normalizeIntervalForDisplay(wfMtf?.interval)) {
        overrides.midTimeframe = {
          ...wfMtf,
          interval: mtfInterval
        };
      }
      if (ltfInterval && ltfInterval !== normalizeIntervalForDisplay(wfLtf?.interval)) {
        overrides.lowTimeframe = {
          ...wfLtf,
          interval: ltfInterval
        };
      }

      // Use fetch with streaming instead of EventSource for better proxy compatibility
      const response = await fetch(`/api/execute/${selectedWorkflow.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream complete');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('Received step:', data.step, data.status, data.data);
              
              if (data.step === 'error' || data.status === 'failed') {
                console.error('Workflow error:', data.data?.message || data.data);
              }
              
              setSteps(prev => {
                const existing = prev.findIndex(s => s.step === data.step);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = data;
                  return updated;
                }
                return [...prev, data];
              });
              
              if (data.step === 'complete' || data.step === 'error') {
                setIsRunning(false);
                fetchHistory();
              }
              // Auto-expand analysis step when it completes
              if (data.step === 'analysis' && data.status === 'completed') {
                setExpandedStep('analysis');
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e, line);
            }
          }
        }
      }
    } catch (err) {
      console.error('Workflow execution failed:', err);
      setSteps(prev => [...prev, {
        step: 'error',
        status: 'failed',
        data: { message: err.message }
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const stopWorkflow = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  const getStepStatus = (stepName) => {
    const step = steps.find(s => s.step === stepName);
    return step?.status || 'pending';
  };

  const getStepData = (stepName) => {
    return steps.find(s => s.step === stepName)?.data;
  };

  const analysisData = getStepData('analysis');
  const chartsData = getStepData('charts');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Execution Panel */}
      <div className="lg:col-span-2 space-y-6">
        {/* Workflow Selector & Run Button */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-2">Select Workflow</label>
              <select
                value={selectedWorkflow?.id || ''}
                onChange={(e) => {
                  const wf = workflows.find(w => w.id === e.target.value);
                  setSelectedWorkflow(wf);
                }}
                disabled={isRunning}
                className="w-full px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-white appearance-none"
              >
                <option value="">Select a workflow...</option>
                {workflows.map(wf => (
                  <option key={wf.id} value={wf.id}>{wf.name}</option>
                ))}
              </select>
            </div>
            
            {isRunning ? (
              <button
                onClick={stopWorkflow}
                className="btn btn-danger mt-7"
              >
                <Pause className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={runWorkflow}
                disabled={!selectedWorkflow}
                className="btn btn-success mt-7"
              >
                <Play className="w-4 h-4" />
                Run Workflow
              </button>
            )}
          </div>
          
          {selectedWorkflow && (
            <div className="mt-4 pt-4 border-t border-terminal-border space-y-3">
              {/* Symbol Override Input */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 whitespace-nowrap">Symbol:</label>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={symbolOverride}
                    onChange={(e) => setSymbolOverride(e.target.value.toUpperCase())}
                    disabled={isRunning}
                    placeholder="EXCHANGE:SYMBOL"
                    className="flex-1 px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setSymbolOverride(e.target.value);
                    }}
                    disabled={isRunning}
                    className="px-3 py-2 bg-terminal-bg border border-terminal-border rounded-lg text-slate-400 text-sm appearance-none cursor-pointer hover:border-slate-500"
                    value=""
                  >
                    <option value="">Quick Select...</option>
                    {Object.entries(COMMON_SYMBOLS).map(([exchange, symbols]) => (
                      <optgroup key={exchange} label={exchange}>
                        {symbols.map(sym => (
                          <option key={`${exchange}:${sym}`} value={`${exchange}:${sym}`}>
                            {exchange}:{sym}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Timeframe Overrides */}
              <div className="grid grid-cols-3 gap-3">
                {/* HTF */}
                <div>
                  <label className="block text-xs text-blue-400 mb-1">HTF (High)</label>
                  <select
                    value={htfInterval}
                    onChange={(e) => setHtfInterval(e.target.value)}
                    disabled={isRunning}
                    className="w-full px-2 py-1.5 bg-terminal-bg border border-blue-500/30 rounded text-white text-sm"
                  >
                    {TIMEFRAMES.map(tf => (
                      <option key={tf.value} value={tf.value}>{tf.label}</option>
                    ))}
                  </select>
                </div>

                {/* MTF - only show if enabled in workflow */}
                {getWorkflowField(selectedWorkflow, 'midTimeframe')?.enabled && (
                  <div>
                    <label className="block text-xs text-purple-400 mb-1">MTF (Mid)</label>
                    <select
                      value={mtfInterval}
                      onChange={(e) => setMtfInterval(e.target.value)}
                      disabled={isRunning}
                      className="w-full px-2 py-1.5 bg-terminal-bg border border-purple-500/30 rounded text-white text-sm"
                    >
                      {TIMEFRAMES.map(tf => (
                        <option key={tf.value} value={tf.value}>{tf.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* LTF */}
                <div>
                  <label className="block text-xs text-amber-400 mb-1">LTF (Low)</label>
                  <select
                    value={ltfInterval}
                    onChange={(e) => setLtfInterval(e.target.value)}
                    disabled={isRunning}
                    className="w-full px-2 py-1.5 bg-terminal-bg border border-amber-500/30 rounded text-white text-sm"
                  >
                    {TIMEFRAMES.map(tf => (
                      <option key={tf.value} value={tf.value}>{tf.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AI Provider Badge & Reset Button */}
              <div className="flex items-center justify-between">
                {(() => {
                  const aiProvider = getWorkflowField(selectedWorkflow, 'aiProvider');
                  const aiConfig = getWorkflowField(selectedWorkflow, 'aiConfig');
                  return (
                    <span className={`px-3 py-1 text-sm rounded border ${
                      aiProvider === 'openai'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    }`}>
                      {aiProvider === 'openai' ? 'OpenAI' : 'Claude'}: {aiConfig?.model}
                    </span>
                  );
                })()}

                {/* Reset All Overrides - show if any value differs from workflow defaults */}
                {(symbolOverride !== selectedWorkflow.symbol ||
                  htfInterval !== normalizeIntervalForDisplay(getWorkflowField(selectedWorkflow, 'highTimeframe')?.interval) ||
                  mtfInterval !== normalizeIntervalForDisplay(getWorkflowField(selectedWorkflow, 'midTimeframe')?.interval) ||
                  ltfInterval !== normalizeIntervalForDisplay(getWorkflowField(selectedWorkflow, 'lowTimeframe')?.interval)) && (
                  <button
                    onClick={() => syncOverridesFromWorkflow(selectedWorkflow)}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    title="Reset all to workflow defaults"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset All
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Execution Steps */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Execution Progress</h3>
          
          <div className="space-y-3">
            {['init', 'charts', 'analysis', 'webhook', 'complete'].map((stepName, index) => {
              const config = STEP_CONFIG[stepName];
              const status = getStepStatus(stepName);
              const data = getStepData(stepName);
              const Icon = config.icon;
              const isExpanded = expandedStep === stepName;
              
              return (
                <motion.div
                  key={stepName}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' :
                      status === 'running' ? 'bg-blue-500/5 border-blue-500/30 animate-pulse' :
                      status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                      status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                      status === 'skipped' ? 'bg-slate-500/5 border-slate-500/20' :
                      'bg-slate-800/30 border-slate-700/50'
                    }`}
                  >
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => data && setExpandedStep(isExpanded ? null : stepName)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                          status === 'skipped' ? 'bg-slate-500/20 text-slate-400' :
                          'bg-slate-700 text-slate-500'
                        }`}>
                          {status === 'running' ? (
                            <div className="spinner" />
                          ) : status === 'completed' ? (
                            <Check className="w-5 h-5" />
                          ) : status === 'failed' ? (
                            <X className="w-5 h-5" />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{config.label}</div>
                          {data?.message && (
                            <div className="text-sm text-slate-400">{data.message}</div>
                          )}
                        </div>
                      </div>
                      
                      {data && (
                        <button className="p-1 text-slate-400 hover:text-white">
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                      )}
                    </div>
                    
                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && data && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-slate-700/50">
                            {stepName === 'charts' && data.charts && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {data.charts.map((chart, idx) => (
                                  <div key={idx} className="relative rounded-lg overflow-hidden bg-slate-900">
                                    {chart.image ? (
                                      <img 
                                        src={chart.image} 
                                        alt={chart.label}
                                        className="w-full h-auto"
                                      />
                                    ) : (
                                      <div className="h-32 flex items-center justify-center text-slate-500">
                                        Failed to load
                                      </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/70 text-xs text-white">
                                      {chart.label}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {stepName === 'analysis' && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-slate-400">AI Response</span>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(
                                      typeof data.response === 'object'
                                        ? JSON.stringify(data.response, null, 2)
                                        : data.response
                                    )}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" /> Copy
                                  </button>
                                </div>
                                <div className="p-3 bg-slate-900 rounded-lg text-sm overflow-auto max-h-96 font-mono">
                                  {typeof data.response === 'object' ? (
                                    <JsonTree data={data.response} defaultExpanded={true} />
                                  ) : (
                                    <pre className="text-slate-300 whitespace-pre-wrap">{data.response}</pre>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {stepName === 'webhook' && (
                              <pre className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 overflow-auto max-h-48 font-mono">
                                {JSON.stringify(data.response, null, 2)}
                              </pre>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Trade Signal Card */}
        {analysisData?.response && typeof analysisData.response === 'object' && (
          <TradeSignalCard data={analysisData.response} />
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Chart Preview */}
        {chartsData?.charts && (
          <div className="card">
            <h4 className="text-sm font-medium text-slate-400 mb-3">Chart Images</h4>
            <div className="space-y-3">
              {chartsData.charts.filter(c => c.image).map((chart, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden">
                  <img 
                    src={chart.image} 
                    alt={chart.label}
                    className="w-full h-auto"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent text-xs text-white">
                    {chart.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Execution History */}
        <div className="card">
          <h4 className="text-sm font-medium text-slate-400 mb-3">Recent Executions</h4>
          <div className="space-y-2">
            {executionHistory.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No executions yet</p>
            ) : (
              executionHistory.map((exec) => (
                <div 
                  key={exec.id}
                  className="p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white text-sm truncate">
                      {exec.workflowName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(exec.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{exec.symbol}</span>
                    {exec.aiResponse?.trade_execution?.decision && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        exec.aiResponse.trade_execution.decision.includes('LONG') 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : exec.aiResponse.trade_execution.decision.includes('SHORT')
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {exec.aiResponse.trade_execution.decision}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* API Info */}
        <div className="card">
          <h4 className="text-sm font-medium text-slate-400 mb-3">API Trigger</h4>
          <div className="space-y-2">
            <div className="p-2 bg-slate-900 rounded-lg">
              <code className="text-xs text-emerald-400 break-all">
                POST /api/run/{selectedWorkflow?.id || '{workflow_id}'}
              </code>
            </div>
            <p className="text-xs text-slate-500">
              Trigger this workflow programmatically via API
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeSignalCard({ data }) {
  const decision = data.trade_execution?.decision || 'NO TRADE';
  const isLong = decision.includes('LONG');
  const isShort = decision.includes('SHORT');
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`card ${
        isLong ? 'signal-long' : isShort ? 'signal-short' : 'signal-neutral'
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Trade Signal</h3>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
          isLong ? 'bg-emerald-500/20 text-emerald-400' :
          isShort ? 'bg-red-500/20 text-red-400' :
          'bg-slate-500/20 text-slate-400'
        }`}>
          {isLong ? <TrendingUp className="w-5 h-5" /> : 
           isShort ? <TrendingDown className="w-5 h-5" /> : 
           <Minus className="w-5 h-5" />}
          {decision}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bias */}
        {data.chart_a_bias && (
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-slate-400">HTF Bias</span>
            </div>
            <div className={`text-lg font-bold mb-1 ${
              data.chart_a_bias.bias_determined === 'BULLISH' ? 'text-emerald-400' :
              data.chart_a_bias.bias_determined === 'BEARISH' ? 'text-red-400' :
              'text-slate-400'
            }`}>
              {data.chart_a_bias.bias_determined}
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">
              {data.chart_a_bias.visual_observation}
            </p>
          </div>
        )}
        
        {/* Setup */}
        {data.chart_b_setup && (
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-sm font-medium text-slate-400">Setup</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-lg font-bold ${
                data.chart_b_setup.is_valid ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {data.chart_b_setup.setup_type}
              </span>
              {data.chart_b_setup.is_valid && <Check className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-xs text-slate-500">
              {data.chart_b_setup.distance_from_zero}
            </p>
          </div>
        )}
        
        {/* Trigger */}
        {data.chart_c_trigger && (
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-slate-400">Trigger</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-lg font-bold ${
                data.chart_c_trigger.trigger_confirmed ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {data.chart_c_trigger.trigger_confirmed ? 'CONFIRMED' : 'NOT CONFIRMED'}
              </span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2">
              {data.chart_c_trigger.histogram_action}
            </p>
          </div>
        )}
      </div>
      
      {/* Trade Details */}
      {data.trade_execution && (isLong || isShort) && (
        <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-slate-500">Stop Loss</span>
            <p className="text-sm text-white font-medium">
              {data.trade_execution.stop_loss_location}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Take Profit</span>
            <p className="text-sm text-white font-medium">
              {data.trade_execution.take_profit_guidance}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
