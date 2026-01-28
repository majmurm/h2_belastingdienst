import http from "http";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const modelPath = path.join(repoRoot, "dashboard", "model_adapter.py");
const pythonCmd = process.env.PYTHON || "python3";
const port = process.env.MODEL_PORT ? Number(process.env.MODEL_PORT) : 7071;

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) {
        reject(new Error("Request payload too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

const writeJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

let activeProgressPath = null;

const runModel = async (config, { signal } = {}) => {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), "sme-model-"));
  const configPath = path.join(tempDir, "config.json");
  const progressPath = path.join(tempDir, "progress.json");
  activeProgressPath = progressPath;
  await fs.writeFile(configPath, JSON.stringify(config), "utf-8");

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, [modelPath, "--json", "--config", configPath, "--progress", progressPath], {
      cwd: repoRoot,
    });

    let stdout = "";
    let stderr = "";
    let abortTimeout = null;

    const killChild = () => {
      if (child.killed) return;
      // Try a graceful stop first, then force kill if needed.
      child.kill("SIGTERM");
      abortTimeout = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 2000);
    };

    const onAbort = () => {
      killChild();
      reject(new Error("Model run interrupted."));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (abortTimeout) {
        clearTimeout(abortTimeout);
      }
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      if (signal?.aborted) {
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr || `Model exited with code ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error("Failed to parse model output as JSON."));
      }
    });
  }).finally(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
    if (activeProgressPath === progressPath) {
      activeProgressPath = null;
    }
  });
};

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/model/run") {
    const abortController = new AbortController();
    res.on("close", () => {
      // Only treat as an interrupt if the response was not completed.
      if (!res.writableEnded) {
        abortController.abort();
      }
    });
    try {
      const body = await readBody(req);
      const config = JSON.parse(body || "{}");
      const results = await runModel(config, { signal: abortController.signal });
      writeJson(res, 200, results);
    } catch (err) {
      const status = abortController.signal.aborted ? 499 : 500;
      writeJson(res, status, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && req.url === "/api/model/progress") {
    if (!activeProgressPath) {
      writeJson(res, 200, { current_step: 0, total_steps: 0, running: false });
      return;
    }
    try {
      const data = await fs.readFile(activeProgressPath, "utf-8");
      const payload = JSON.parse(data);
      writeJson(res, 200, { ...payload, running: true });
    } catch (err) {
      writeJson(res, 200, { current_step: 0, total_steps: 0, running: true });
    }
    return;
  }

  writeJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Model server listening on http://localhost:${port}`);
});
