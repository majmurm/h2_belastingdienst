import { ModelConfig, ModelResults } from "./modelTypes";

export async function runModel(
  config: ModelConfig,
  options?: { signal?: AbortSignal },
): Promise<ModelResults> {
  const response = await fetch("/api/model/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
    signal: options?.signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Model run failed.";
    throw new Error(message);
  }

  return response.json();
}

export async function fetchModelProgress(): Promise<{
  current_step: number;
  total_steps: number;
  running: boolean;
}> {
  const response = await fetch("/api/model/progress");
  if (!response.ok) {
    throw new Error("Failed to fetch model progress.");
  }
  return response.json();
}
