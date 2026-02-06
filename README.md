# SME Tax Compliance Simulation (Dashboard + Model)

This repository combines a Python-based agent‑based model with a React dashboard. It includes a local API server that runs the model and returns JSON results to the UI.

## ✅ What’s in this repo

- **Python model**: `model_final.py`, `agents_final.py`, `report_results_final.py`
- **Dashboard**: `dashboard/` (React + Vite)
- **Model adapter/API**: `dashboard/model_adapter.py`, `dashboard/scripts/model-server.mjs`

## 📋 Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.10+**
- **pip**

## 🛠️ Install

From the repo root:

```bash
pip install -r requirements.txt
cd dashboard
npm install
```

## ▶️ Run Locally (Dev)

### 1) Start the dashboard
```bash
cd dashboard
npm run dev
```

### 2) Start the model API server
```bash
cd dashboard
npm run model:server
```

Open: `http://localhost:5173`

## 📦 Build (Production)

### Standard build
```bash
cd dashboard
npm run build
```
Output: `dashboard/dist/`

### Single‑file build
```bash
cd dashboard
npm run build:single
```
Output: `dashboard/dist/index.html`

> Note: single‑file build is **frontend‑only**. The model still requires the API server or Docker.

## 🐳 Docker (Full App)

Build:
```bash
docker build -t belastingdienst-app .
```

Run:
```bash
docker run --rm -p 7071:7071 belastingdienst-app
```

Open: `http://localhost:7071`

## 🧪 Reproducibility

- Default parameters are defined in:
  - `report_results.py`
  - `dashboard/model_adapter.py`
  - `dashboard/src/data/modelDefaults.ts`
- Default seed: `42`

## 🩺 Troubleshooting

- **Import errors when running the dashboard locally**  
  The model server is launched by Node.js and may use a different Python interpreter than your shell.  
  If you see missing‑package import errors, install dependencies for the Python interpreter that Node is calling.  
  Depending on your setup, this can mean installing packages **system‑wide** instead of inside a virtual environment.

## 📚 Key Files

- `model.py` – core simulation
- `agents.py` – agent definitions
- `report_results.py` – reference model run output
- `dashboard/model_adapter.py` – adapter used by the dashboard API
- `dashboard/scripts/model-server.mjs` – API + static frontend server
