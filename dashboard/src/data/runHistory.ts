import type { ModelConfig, ModelResults } from "./modelTypes";

export interface RunSummary {
  initialMean: number;
  finalMean: number;
  deltaMean: number;
  taxGapReduction: number;
  taxGapReductionPct: number;
  totalCost: number;
  netBenefit: number;
  roiRatio: number;
}

export interface RunRecord {
  id: string;
  timestamp: string;
  config: ModelConfig;
  results: ModelResults;
  summary: RunSummary;
  runtimeMs?: number;
}
