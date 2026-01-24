import { ModelConfig } from "./modelTypes";

export const defaultModelConfig: ModelConfig = {
  N: 10000,
  size_shares: {
    Micro: 0.9683,
    Small: 0.0248,
    Medium: 0.0053,
  },
  age_shares: {
    Young: 0.57,
    Mature: 0.04,
    Old: 0.39,
  },
  C_target: 0.693,
  m_size: 0.05,
  m_age: 0.05,
  kappa: 339,
  audit_rates: {
    "Micro-Young": 0.0046,
    "Micro-Mature": 0.0046,
    "Micro-Old": 0.0046,
    "Small-Young": 0.0046,
    "Small-Mature": 0.0046,
    "Small-Old": 0.0046,
    "Medium-Young": 0.0046,
    "Medium-Mature": 0.0046,
    "Medium-Old": 0.0046,
  },
  audit_types: {
    Light: { effect: 0.45, cost: 500.0 },
    Standard: { effect: 0.9, cost: 775.0 },
    Deep: { effect: 1.8, cost: 1550.0 },
  },
  channel_effects: {
    physical_letter: 0.003,
    email: 0.008,
    warning_letter: 0.02,
  },
  intervention_costs: {
    email: 0.05,
    physical_letter: 0.85,
    warning_letter: 20.96,
  },
  decay_factor: 0.00005,
  seed: 42,
  steps: 260,
  tax_deadline_week: 12,
  audit_delay_weeks: 8,
  warning_visit_week: 35,
};
