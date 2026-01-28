export type SizeCategory = "Micro" | "Small" | "Medium";
export type AgeCategory = "Young" | "Mature" | "Old";
export type GroupKey = `${SizeCategory}-${AgeCategory}`;

export type ChannelKey = "physical_letter" | "email" | "warning_letter";
export type AuditTypeKey = "Light" | "Standard" | "Deep";
export type SectorKey =
  | "Business Economy, B-N, excl. K, incl. 95"
  | "B Delfstoffenwinning"
  | "C Industrie"
  | "D Energievoorziening"
  | "E Waterbedrijven en afvalbeheer"
  | "F Bouwnijverheid"
  | "G Handel"
  | "H Vervoer en opslag"
  | "I Horeca"
  | "J Informatie en communicatie"
  | "L Verhuur en handel van onroerend goed"
  | "M Specialistische zakelijke diensten"
  | "N Verhuur en overige zakelijke diensten";

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

export interface TaxGapEntry {
  potential: number;
  actual: number;
  gap: number;
  gap_pct: number;
}

export interface TaxGap {
  total_potential: number;
  total_actual: number;
  total_gap: number;
  gap_pct: number;
  by_size: Record<SizeCategory, TaxGapEntry>;
  by_group: Record<GroupKey, TaxGapEntry>;
  by_sector: Record<SectorKey, TaxGapEntry>;
}

export interface StepMetrics {
  step: number;
  overall_mean: number;
  mean_by_group: Record<GroupKey, number>;
  mean_by_sector: Record<SectorKey, number>;
  overall_audited_pct: number;
  high_compliance_pct: number;
  tax_gap: TaxGap;
  total_cost: number;
  network_gif?: string;
}

export interface ModelResults {
  config: ModelConfig;
  initial: {
    overall_mean: number;
    mean_by_group: Record<GroupKey, number>;
    mean_by_sector: Record<SectorKey, number>;
    tax_gap: TaxGap;
  };
  steps: StepMetrics[];
  final: StepMetrics;
  summary: {
    tax_gap_reduction: number;
    total_cost: number;
    net_benefit: number;
    roi_ratio: number;
  };
}
