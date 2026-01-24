import { ModelConfig, ModelResults } from "./modelTypes";

export async function runModel(config: ModelConfig): Promise<ModelResults> {
  const response = await fetch("/api/model/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Model run failed.";
    throw new Error(message);
  }

  return response.json();
}
