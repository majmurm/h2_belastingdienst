export type SizeCategory = "Micro" | "Small" | "Medium";
export type AgeCategory = "Young" | "Mature" | "Old";
export type GroupKey = `${SizeCategory}-${AgeCategory}`;

export type ChannelKey = "physical_letter" | "email" | "warning_letter";
export type AuditTypeKey = "Light" | "Standard" | "Deep";

export type SectorKey =
  | "Industry and Energy (B-E)"
  | "Construction (F)"
  | "Trade, Transport and Hospitality (G-I)"
  | "Information and Communication (J)"
  | "Real Estate (L)"
  | "Business Services (M-N)";

export interface ModelConfig {
  N: number;
  size_shares: Record<SizeCategory, number>;
  age_shares: Record<AgeCategory, number>;
  sector_shares: Record<SectorKey, number>;
  selected_sectors: SectorKey[];
  C_target: number;
  m_size: number;
  m_age: number;
  kappa: number;
  audit_rates: Record<GroupKey, number>;
  audit_types: Record<AuditTypeKey, { effect: number; cost: number }>;
  audit_hours: Record<AuditTypeKey, number>;
  audit_hour_price: Record<AuditTypeKey, number>;
  channel_effects: Record<ChannelKey, number>;
  intervention_costs: Record<ChannelKey, number>;
  communication_schedule: Record<number, ChannelKey[]>;
  n_runs: number;
  include_visualization: boolean;
  tax_gap_target_rate: number;
  noncompliance_target_rate: number;
  calibrate_baseline: boolean;
  underpayment_mean_if_noncompliant: number | null;
  decay_factor: number;
  seed: number;
  n_neighbours: number;
  steps: number;
  tax_deadline_week: number;
  audit_delay_weeks: number;
  warning_visit_week: number;
}