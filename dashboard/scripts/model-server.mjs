import http from "http";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const modelPath = path.join(repoRoot, "Initial_Model_visualization5.py");
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

const runModel = async (config) => {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), "sme-model-"));
  const configPath = path.join(tempDir, "config.json");
  await fs.writeFile(configPath, JSON.stringify(config), "utf-8");

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, [modelPath, "--json", "--config", configPath], {
      cwd: repoRoot,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
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
  });
};

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/model/run") {
    try {
      const body = await readBody(req);
      const config = JSON.parse(body || "{}");
      const results = await runModel(config);
      writeJson(res, 200, results);
    } catch (err) {
      writeJson(res, 500, { error: err.message });
    }
    return;
  }

  writeJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Model server listening on http://localhost:${port}`);
});
