export type SizeCategory = "Micro" | "Small" | "Medium";
export type AgeCategory = "Young" | "Mature" | "Old";
export type GroupKey = `${SizeCategory}-${AgeCategory}`;

export type ChannelKey = "physical_letter" | "email" | "warning_letter";
export type AuditTypeKey = "Light" | "Standard" | "Deep";
export type SectorKey =
  | "Business Economy, B-N, excl. K, incl. 95"
  | "B-E Nijverheid (geen bouw) en energie"
  | "F Bouwnijverheid"
  | "G-I Handel, vervoer en horeca"
  | "J Informatie en communicatie"
  | "L Verhuur en handel van onroerend goed"
  | "M-N Zakelijke dienstverlening";

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
  channel_effects: Record<ChannelKey, number>;
  intervention_costs: Record<ChannelKey, number>;
  decay_factor: number;
  seed: number;
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
