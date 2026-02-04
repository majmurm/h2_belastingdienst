import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const modelPath = path.join(repoRoot, "dashboard", "model_adapter.py");
const pythonCmd = process.env.PYTHON || "python3";
const port = process.env.PORT || 7071; // Render uses PORT env var

const app = express();

// 1. Serve Static Frontend Files
// This points to the 'dist' folder created by 'npm run build'
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

app.use(express.json({ limit: '50mb' }));

// 2. API Route: Run Model
app.post('/api/model/run', async (req, res) => {
  const config = req.body;
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), "sme-model-"));
  const configPath = path.join(tempDir, "config.json");
  const progressPath = path.join(tempDir, "progress.json");
  
  // Store progress path for the active request (simplified for single-user demo)
  app.locals.activeProgressPath = progressPath;

  try {
    await fs.writeFile(configPath, JSON.stringify(config), "utf-8");

    const result = await new Promise((resolve, reject) => {
      const child = spawn(pythonCmd, [modelPath, "--json", "--config", configPath, "--progress", progressPath], {
        cwd: repoRoot,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => stdout += chunk.toString());
      child.stderr.on("data", (chunk) => stderr += chunk.toString());

      child.on("close", (code) => {
        if (code !== 0) reject(new Error(stderr || `Exited with code ${code}`));
        else resolve(JSON.parse(stdout));
      });
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    // Cleanup
    app.locals.activeProgressPath = null;
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

// 3. API Route: Check Progress
app.get('/api/model/progress', async (req, res) => {
  const progressPath = app.locals.activeProgressPath;
  if (!progressPath) {
    return res.json({ current_step: 0, total_steps: 0, running: false });
  }
  try {
    const data = await fs.readFile(progressPath, 'utf-8');
    res.json({ ...JSON.parse(data), running: true });
  } catch (e) {
    res.json({ current_step: 0, total_steps: 0, running: true });
  }
});

// 4. Catch-all: Serve index.html for any other requests (SPA support)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});