import { ModelConfig, SectorKey, SizeCategory } from "./modelTypes";
import sectorDefaults from "./sectorDefaults.json";

const computeSizeSharesFromSectors = (selected: SectorKey[]) => {
  const bySector = sectorDefaults.size_shares_by_sector as Record<
    SectorKey,
    Record<SizeCategory, number>
  >;
  const sectorShares = sectorDefaults.sector_shares as Record<SectorKey, number>;
  const totals: Record<SizeCategory, number> = { Micro: 0, Small: 0, Medium: 0 };
  selected.forEach((sector) => {
    const weights = bySector[sector];
    const sectorWeight = sectorShares[sector] ?? 0;
    if (!weights) return;
    totals.Micro += sectorWeight * (weights.Micro ?? 0);
    totals.Small += sectorWeight * (weights.Small ?? 0);
    totals.Medium += sectorWeight * (weights.Medium ?? 0);
  });
  const total = totals.Micro + totals.Small + totals.Medium;
  if (total <= 0) return totals;
  return {
    Micro: totals.Micro / total,
    Small: totals.Small / total,
    Medium: totals.Medium / total,
  };
};

export const defaultModelConfig: ModelConfig = {
  N: 10000,
  size_shares: computeSizeSharesFromSectors(sectorDefaults.sectors_individual),
  age_shares: {
    Young: 0.38,
    Mature: 0.24,
    Old: 0.38,
  },
  sector_shares: sectorDefaults.sector_shares,
  selected_sectors: sectorDefaults.sectors_individual,
  C_target: 0.693,
  m_size: 0.05,
  m_age: 0.05,
  kappa: 339,
  audit_rates: {
    "Micro-Young": 0.02,
    "Micro-Mature": 0.02,
    "Micro-Old": 0.02,
    "Small-Young": 0.02,
    "Small-Mature": 0.02,
    "Small-Old": 0.02,
    "Medium-Young": 0.02,
    "Medium-Mature": 0.02,
    "Medium-Old": 0.02,
  },
  audit_types: {
    Light: { effect: 0.9, cost: 2340 },
    Standard: { effect: 0.9, cost: 2340 },
    Deep: { effect: 1.8, cost: 4680 },
  },
  audit_hours: {
    Light: Math.max(0, Math.round(2340 / 60)),
    Standard: Math.max(0, Math.round(2340 / 60)),
    Deep: Math.max(0, Math.round(4680 / 60)),
  },
  audit_hour_price: {
    Light: 60,
    Standard: 60,
    Deep: 60,
  },
  channel_effects: {
    physical_letter: 0.003,
    email: 0.008,
    warning_letter: 0.02,
  },
  intervention_costs: {
    email: 0.39,
    physical_letter: 0.65,
    warning_letter: 196.84,
  },
  communication_schedule: {
    8: ["physical_letter", "email"],
    6: ["email"],
    2: ["physical_letter"],
    1: ["email"],
  },
  n_runs: 1,
  include_visualization: true,
  tax_gap_target_rate: 0.05,
  noncompliance_target_rate: 0.3,
  calibrate_baseline: true,
  underpayment_mean_if_noncompliant: null,
  decay_factor: 0.0005,
  seed: 42,
  n_neighbours: 4,
  steps: 208,
  tax_deadline_week: 12,
  audit_delay_weeks: 8,
  warning_visit_week: 35,
};
