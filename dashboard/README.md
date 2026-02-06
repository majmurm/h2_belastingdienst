
README of original repo that allowed us to use Figma prototype:
https://github.com/likang/figma-make-local-runner

The dashboard utilized code generated in Figma Make and integrates it with our agent-based model using `model.py`, `agents.py`, `report_results.py`, and the dashboard adapter/server (`dashboard/model_adapter.py`, `dashboard/scripts/model-server.mjs`).

This README explains how to run the **frontend** and the **Python model server** together, and how to produce a single-file build.

The **Information about the Model** pane provides a concise, non-technical overview of the model. It explains what the agent-based simulation represents, how the SME population is defined (size, age, and sector scope), how baseline compliance propensities are initialized, which advanced parameters the model uses (with defaults and formulas), and how audits and communications drive behavior over time. It also summarizes the meaning of key outputs such as compliance trends, tax gap, and intervention costs/ROI.

# Figma Make Local Runner (Original README)

A skeleton project designed to run code downloaded from Figma Make locally, so you can easily modify the generated code with your favorite tools.

> Figma now allows you to download an entire runnable project directly.  
> You may try this project if you encounter issues running the project downloaded from Figma Make

This project also includes a `build:single` command to generate a single HTML file containing your entire app.  
This is useful if you want to share your app as a standalone file.

## ⚡ How It Works

1. **Pre-installed Packages**  
   This project comes with many packages that Figma Make-generated code may require (see `package.json`). If you encounter errors about missing dependencies, simply install the required packages using `npm install <package-name>`.

2. **Automatic Removal of Version Specifiers in Imports**  
   Figma Make sometimes generates import statements with explicit version specifiers, for example:

   ```js
   import { Slot } from "@radix-ui/react-slot@1.1.2";
   ```

   This can cause version conflicts or issues with local development.  
   **Solution:**  
   This project uses a custom Vite plugin that automatically removes version specifiers from import statements during build and development.  
   The above import will be transformed to:

   ```js
   import { Slot } from "@radix-ui/react-slot";
   ```

   This ensures compatibility with the dependencies installed in your project.

   > If you still see errors about missing packages, install them manually as needed.

3. **Resolve `figma:asset/` Imports**  
   Figma Make may generate imports like:

   ```js
   import logo from "figma:asset/logo.svg";
   ```

   This project includes a custom Vite plugin that automatically resolves these imports to files in your local `src/assets` directory.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Python](https://www.python.org/) (version 3.10+ recommended)

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/likang/figma-make-local-runner
cd figma-make-local-runner
```

### 2. Download Code from Figma Make

1. Export your code from Figma Make
2. Decompress the downloaded files
3. Copy the `src` folder into the root of this project, replacing the existing `src` folder.

**Important**: Make sure to replace or merge with the existing files in the `src` folder. The current `src` folder contains a demo application that you should replace with your Figma Make code.

### 3. Install Dependencies

```bash
npm install
```

### 3b. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is occupied).

### 5. Start the Model Server (API)

In a separate terminal:

```bash
npm run model:server
```

This starts the API at `http://localhost:7071` (configurable via `PORT`/`MODEL_PORT`).

## ▶️ Run the Full App (Frontend + Model)

1. Start the frontend:
   ```bash
   npm run dev
   ```
2. Start the model server:
   ```bash
   npm run model:server
   ```
3. Open the app:
   ```
   http://localhost:5173
   ```

The dashboard will call the model server at `/api/model/run`.

## 📦 Production Build

### Standard build (multi-file)
```bash
npm run build
```
Output: `dashboard/dist/`

### Single-file build (one HTML file)
```bash
npm run build:single
```
Output: `dashboard/dist/index.html`

**Note:** The single-file build is frontend-only. The Python model still needs to run separately (or via Docker).

## 🐳 Docker (Full App, No Local Python Needed)

Build:
```bash
docker build -t belastingdienst-app .
```

Run:
```bash
docker run --rm -p 7071:7071 belastingdienst-app
```

Open:
```
http://localhost:7071
```

## 📚 Key Files

- `model.py`: core simulation model
- `agents.py`: agent definitions
- `report_results.py`: reference script for model outputs
- `dashboard/model_adapter.py`: translates dashboard config to model run + JSON output
- `dashboard/scripts/model-server.mjs`: API server + static frontend hosting

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
