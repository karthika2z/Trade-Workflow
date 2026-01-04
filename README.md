# AI Trade Workflow — Intelligent Trading Engine

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-green" alt="Node.js">
  <img src="https://img.shields.io/badge/React-18-blue" alt="React">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</div>

A visual workflow engine for technical chart analysis and trading automation. Fetch AI-enhanced TradingView charts, analyze them with AI (Claude or GPT-4), and forward signals to your trading bot.

![ChartFlow Screenshot](docs/screenshot.png)

## ✨ Features

- **Multi-Timeframe Analysis**: Configure high, mid (optional), and low timeframe charts
- **AI-Powered Analysis**: Support for Claude (Anthropic) and GPT-4 (OpenAI) with vision
- **Visual Workflow Builder**: Easy-to-use form-based workflow configuration
- **Real-Time Execution**: Watch each step execute with live progress updates
- **Trade Signal Cards**: Beautiful visualization of AI-generated trading signals
- **Webhook Integration**: Forward signals to any trading bot or system
- **API Trigger**: Execute workflows programmatically via REST API
- **No Database Required**: All data stored in JSON files

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- API keys for:
  - [AICharts](https://tradingview-charts-891341779188.us-central1.run.app/) — AI-enhanced TradingView chart generation
  - [OpenAI](https://platform.openai.com/api-keys) and/or [Anthropic](https://console.anthropic.com/settings/keys) — AI analysis

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/chartflow.git
cd chartflow

# Install dependencies
npm install

# Start development server (frontend + backend)
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## 🐳 Docker Deployment

### Local Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

### Google Cloud Run

1. **Install Google Cloud CLI** and authenticate:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable required APIs**:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   ```

3. **Create Artifact Registry** (if not exists):
   ```bash
   gcloud artifacts repositories create chartflow \
     --repository-format=docker \
     --location=us-central1
   ```

4. **Build and deploy**:
   ```bash
   # Build the container
   gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/chartflow/chartflow:latest

   # Deploy to Cloud Run
   gcloud run deploy chartflow \
     --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/chartflow/chartflow:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 3
   ```

5. **Persistent Storage** (Recommended):
   
   For persistent data storage on Cloud Run, use Cloud Storage:
   ```bash
   # Create a bucket
   gcloud storage buckets create gs://YOUR_BUCKET_NAME --location=us-central1
   
   # Mount the bucket (requires Cloud Run volume mounts - check latest GCP docs)
   ```

   Alternatively, for simpler setups, use **Cloud Run with Cloud SQL** or **Firestore** by modifying the storage layer.

## 📡 API Reference

### Execute Workflow (Streaming)

```bash
# Server-Sent Events (SSE) for real-time progress
curl -N "http://localhost:3001/api/execute/WORKFLOW_ID"
```

### Execute Workflow (Simple)

```bash
# Single JSON response
curl -X POST "http://localhost:3001/api/run/WORKFLOW_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BINANCE:BTCUSDT"  // Optional override
  }'
```

**Response:**
```json
{
  "success": true,
  "workflow": "BTC MACD Strategy",
  "analysis": {
    "chart_a_bias": {
      "visual_observation": "MACD above zero line...",
      "bias_determined": "BULLISH"
    },
    "trade_execution": {
      "decision": "EXECUTE LONG",
      "stop_loss_location": "Below recent swing low",
      "take_profit_guidance": "2.0x Risk Ratio"
    }
  },
  "webhook": {
    "success": true,
    "status": 200
  }
}
```

### List Workflows

```bash
curl "http://localhost:3001/api/workflows"
```

### Get Workflow

```bash
curl "http://localhost:3001/api/workflows/WORKFLOW_ID"
# Or by name:
curl "http://localhost:3001/api/workflows/BTC%20MACD%20Strategy"
```

### Execution History

```bash
curl "http://localhost:3001/api/executions"
```

## 🔧 Configuration

### Workflow Structure

```json
{
  "name": "BTC MACD Triple Screen",
  "symbol": "BINANCE:BTCUSDT",
  "highTimeframe": {
    "interval": "D",
    "indicators": ["MACD"]
  },
  "midTimeframe": {
    "enabled": true,
    "interval": "240",
    "indicators": ["MACD"]
  },
  "lowTimeframe": {
    "interval": "60",
    "indicators": ["MACD"]
  },
  "aiProvider": "anthropic",
  "aiConfig": {
    "model": "claude-sonnet-4-20250514",
    "systemPrompt": "You are an expert technical analyst...",
    "temperature": 0.3,
    "topP": 0.9
  },
  "userPrompt": "Analyze these charts...",
  "webhook": {
    "enabled": true,
    "url": "https://your-bot.com/webhook",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN"
    }
  }
}
```

### AICharts Indicators

Supported indicators include:
- `MACD` — Moving Average Convergence Divergence
- `RSI` — Relative Strength Index
- `BB` — Bollinger Bands
- `EMA` — Exponential Moving Average
- `SMA` — Simple Moving Average
- `VWAP` — Volume Weighted Average Price
- `ATR` — Average True Range
- `StochRSI` — Stochastic RSI
- `IchimokuCloud` — Ichimoku Cloud
- `Volume` — Volume bars

Charts are automatically AI-enhanced for better vision model analysis (GPT-4V, Claude Vision) with optimized contrast and edge detection.

### AI Response Format

Configure your system prompt to return JSON matching your needs:

```json
{
  "chart_a_bias": {
    "visual_observation": "string",
    "bias_determined": "BULLISH | BEARISH | NEUTRAL/CHOP"
  },
  "chart_b_setup": {
    "setup_type": "Trend Crossover | Divergence | None",
    "distance_from_zero": "Sufficient Distance | Too Close (Chop)",
    "is_valid": true | false
  },
  "chart_c_trigger": {
    "histogram_action": "string",
    "trigger_confirmed": true | false
  },
  "trade_execution": {
    "decision": "EXECUTE LONG | EXECUTE SHORT | NO TRADE",
    "stop_loss_location": "string",
    "take_profit_guidance": "string"
  }
}
```

## 🔒 Security Notes

- API keys are stored in `data/settings.json` — **secure this file**
- For Cloud Run, consider using **Secret Manager** for API keys
- Add authentication if exposing publicly (modify `server/index.js`)
- Use HTTPS in production

## 📁 Project Structure

```
chartflow/
├── server/
│   └── index.js          # Express.js backend
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── WorkflowList.jsx
│   │   ├── WorkflowEditor.jsx
│   │   ├── ExecutionView.jsx
│   │   └── SettingsPanel.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── data/                  # JSON storage (gitignored)
│   ├── workflows.json
│   ├── settings.json
│   └── executions.json
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📄 License

MIT License — see LICENSE file for details.

---

Built with ❤️ for retail traders
