import { useEffect, useState, useMemo } from "react";
import { Info, RotateCcw, ChevronRight, Clock } from "lucide-react";
import { Tooltip } from "./Tooltip";
import type { ModelConfig, SizeCategory, AgeCategory, AuditTypeKey, ChannelKey } from "../data/modelTypes";
import { defaultModelConfig } from "../data/modelDefaults";
import styles from "./StrategyPanel.module.css";

interface StrategyPanelProps {
  config: ModelConfig;
  onConfigChange: (config: ModelConfig) => void;
  onReset: () => void;
  onRun: () => void;
  onInterrupt: () => void;
  isRunning: boolean;
  progress?: { current: number; total: number };
}

const sizeOrder: SizeCategory[] = ["Micro", "Small", "Medium"];
const ageOrder: AgeCategory[] = ["Young", "Mature", "Old"];
const auditTypeOrder: AuditTypeKey[] = ["Light", "Standard", "Deep"];
const auditTypeLabels: Record<AuditTypeKey, string> = {
  Light: "Revenue tax",
  Standard: "Corporate income tax",
  Deep: "Deep book",
};
const AUDIT_RATE_MAX = 0.05;
const AUDIT_COST_MAX = 5000;

type TimingUnit = "days" | "weeks" | "months";
type ChannelTiming = { value: number; unit: TimingUnit };

export function StrategyPanel({
  config,
  onConfigChange,
  onReset,
  onRun,
  onInterrupt,
  isRunning,
  progress,
}: StrategyPanelProps) {
  const [auditRateInputs, setAuditRateInputs] = useState<Record<string, string>>({});
  const [auditHourPrice, setAuditHourPrice] = useState<Record<AuditTypeKey, number>>(
    config.audit_hour_price ?? {
      Light: 60,
      Standard: 60,
      Deep: 60,
    },
  );
  const [auditHours, setAuditHours] = useState<Record<AuditTypeKey, number>>(
    config.audit_hours ?? {
      Light: Math.max(0, Math.round(defaultModelConfig.audit_types.Light.cost / 60)),
      Standard: Math.max(0, Math.round(defaultModelConfig.audit_types.Standard.cost / 60)),
      Deep: Math.max(0, Math.round(defaultModelConfig.audit_types.Deep.cost / 60)),
    },
  );

  // --- CHANNEL STATE MANAGEMENT ---
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelLetter, setChannelLetter] = useState(false);
  
  const [channelFrequency, setChannelFrequency] = useState({
    email: 1,
    letter: 1,
  });
  
  const [channelCost, setChannelCost] = useState({
    email: config.intervention_costs.email,
    letter: config.intervention_costs.physical_letter,
  });

  const [channelTimings, setChannelTimings] = useState<{
    email: ChannelTiming[];
    letter: ChannelTiming[];
  }>({
    email: [{ value: 1, unit: "weeks" }],
    letter: [{ value: 1, unit: "weeks" }],
  });

  // Warning Visit Week Input State
  const [warningVisitWeekInput, setWarningVisitWeekInput] = useState<string>(
    config.warning_visit_week ? String(config.warning_visit_week) : "",
  );

  const multiRunEnabled = (config.n_runs ?? 1) > 1;
  const runCount = Math.max(1, config.n_runs ?? 1);

  // Helper to update main config
  const updateConfig = (partial: Partial<ModelConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  // --- SYNC FUNCTION: UI State -> Model Config ---
  // BUG FIX: Removed useCallback here so it always uses the FRESH 'config' state
  const syncScheduleToConfig = (
    useEmail: boolean,
    useLetter: boolean,
    timings: { email: ChannelTiming[]; letter: ChannelTiming[] }
  ) => {
    const newSchedule: Record<number, ChannelKey[]> = {};

    const addToSchedule = (week: number, channel: ChannelKey) => {
      const w = Math.round(week);
      if (w <= 0) return;
      if (!newSchedule[w]) newSchedule[w] = [];
      if (!newSchedule[w].includes(channel)) {
        newSchedule[w].push(channel);
      }
    };

    if (useEmail) {
      timings.email.forEach(t => addToSchedule(t.value, "email"));
    }
    if (useLetter) {
      timings.letter.forEach(t => addToSchedule(t.value, "physical_letter"));
    }

    updateConfig({ communication_schedule: newSchedule });
  };

  // --- EVENT HANDLERS ---

  const handleChannelToggle = (channel: "email" | "letter", checked: boolean) => {
    if (channel === "email") {
      setChannelEmail(checked);
      syncScheduleToConfig(checked, channelLetter, channelTimings);
    } else {
      setChannelLetter(checked);
      syncScheduleToConfig(channelEmail, checked, channelTimings);
    }
  };

  const handleChannelFrequencyChange = (channel: "email" | "letter", value: number) => {
    const next = Math.max(1, Math.min(4, Math.round(value)));
    setChannelFrequency((prev) => ({ ...prev, [channel]: next }));

    let nextTimings = { ...channelTimings };
    const list = [...channelTimings[channel]];
    
    if (list.length < next) {
      const used = new Set(list.map((entry) => entry.value));
      const toAdd: ChannelTiming[] = [];
      let candidate = 1;
      while (toAdd.length < next - list.length && candidate <= 52) {
        if (!used.has(candidate)) {
          toAdd.push({ value: candidate, unit: "weeks" as TimingUnit });
          used.add(candidate);
        }
        candidate += 1;
      }
      nextTimings = { ...nextTimings, [channel]: [...list, ...toAdd] };
    } else if (list.length > next) {
      nextTimings = { ...nextTimings, [channel]: list.slice(0, next) };
    }
    
    setChannelTimings(nextTimings);
    syncScheduleToConfig(channelEmail, channelLetter, nextTimings);
  };

  const updateChannelTiming = (
    channel: "email" | "letter",
    index: number,
    value: number
  ) => {
    const nextTimings = { ...channelTimings };
    const list = [...nextTimings[channel]];
    list[index] = { ...list[index], value: Math.max(1, Math.min(52, value)) };
    nextTimings[channel] = list;
    setChannelTimings(nextTimings);
    syncScheduleToConfig(channelEmail, channelLetter, nextTimings);
  };

  const updateReminderChannelCost = (channel: "email" | "letter", value: number) => {
    const normalized = Math.max(0, value);
    setChannelCost((prev) => ({ ...prev, [channel]: normalized }));
    if (channel === "email") updateConfig({ intervention_costs: { ...config.intervention_costs, email: normalized } });
    if (channel === "letter") updateConfig({ intervention_costs: { ...config.intervention_costs, physical_letter: normalized } });
  };

  // --- ESTIMATED RUNTIME ---
  const estimatedRuntimeLabel = useMemo(() => {
    const COEFF_BASE_LATENCY = 500;
    const COEFF_PER_AGENT_STEP = 0.0167;
    const COEFF_GIF_GENERATION = 2000;
    const COEFF_GIF_PER_AGENT = 7.72;
    const COEFF_GIF_PER_AGENT_SQ = 0.001;

    const N = config.N;
    const steps = config.steps;
    const runs = config.n_runs ?? 1;
    const isGifEnabled = config.include_visualization ?? true;

    const computeTime = N * steps * runs * COEFF_PER_AGENT_STEP;
    let visTime = 0;
    if (isGifEnabled) {
      visTime = COEFF_GIF_GENERATION + (N * COEFF_GIF_PER_AGENT) + (N * N * COEFF_GIF_PER_AGENT_SQ);
    }

    const totalMs = COEFF_BASE_LATENCY + computeTime + visTime;
    const seconds = Math.round(totalMs / 1000);

    if (seconds < 60) return "< 1 min";
    const mins = Math.ceil(seconds / 60);
    return `~${mins} mins`;
  }, [config.N, config.steps, config.n_runs, config.include_visualization]);


  // --- EFFECTS ---
  useEffect(() => {
    const formatted: Record<string, string> = {};
    Object.entries(config.audit_rates).forEach(([key, value]) => {
      formatted[key] = (value * 100).toFixed(2);
    });
    setAuditRateInputs(formatted);
  }, [config.audit_rates]);

  useEffect(() => {
    setChannelCost((prev) => ({
      ...prev,
      email: config.intervention_costs.email,
      letter: config.intervention_costs.physical_letter,
    }));
  }, [config.intervention_costs.email, config.intervention_costs.physical_letter]);

  useEffect(() => {
    const schedule = config.communication_schedule ?? {};
    const emailWeeks: ChannelTiming[] = [];
    const letterWeeks: ChannelTiming[] = [];

    Object.entries(schedule).forEach(([weekStr, channels]) => {
      const week = Math.max(1, Math.min(52, Number(weekStr)));
      (channels as string[]).forEach((channel) => {
        if (channel === "email") {
          emailWeeks.push({ value: week, unit: "weeks" });
        }
        if (channel === "physical_letter") {
          letterWeeks.push({ value: week, unit: "weeks" });
        }
      });
    });

    emailWeeks.sort((a, b) => b.value - a.value);
    letterWeeks.sort((a, b) => b.value - a.value);

    setChannelEmail(emailWeeks.length > 0);
    setChannelLetter(letterWeeks.length > 0);
    setChannelTimings({
      email: emailWeeks.length > 0 ? emailWeeks : [{ value: 1, unit: "weeks" }],
      letter: letterWeeks.length > 0 ? letterWeeks : [{ value: 1, unit: "weeks" }],
    });
    setChannelFrequency({
      email: Math.max(1, Math.min(4, emailWeeks.length || 1)),
      letter: Math.max(1, Math.min(4, letterWeeks.length || 1)),
    });
  }, [config.communication_schedule]);

  useEffect(() => {
    setWarningVisitWeekInput(config.warning_visit_week ? String(config.warning_visit_week) : "");
  }, [config.warning_visit_week]);


  // --- AUDIT HELPERS ---
  const updateAuditRate = (size: SizeCategory, age: AgeCategory, pct: number) => {
    const key = `${size}-${age}` as const;
    const rate = Math.max(0, Math.min(AUDIT_RATE_MAX, pct / 100));
    const updated = { ...config.audit_rates, [key]: rate };
    updateConfig({ audit_rates: updated });
  };

  const parsePercentInput = (raw: string) => {
    const normalized = raw.replace(",", ".").trim();
    const value = parseFloat(normalized);
    return Number.isNaN(value) ? null : value;
  };

  const resetAuditType = (type: AuditTypeKey) => {
    const defaultCost = defaultModelConfig.audit_types[type].cost;
    const defaultPrice = 60;
    const defaultHours = Math.max(0, Math.round(defaultCost / defaultPrice));
    setAuditHourPrice((prev) => ({ ...prev, [type]: defaultPrice }));
    setAuditHours((prev) => ({ ...prev, [type]: defaultHours }));
    updateConfig({
      audit_types: { ...config.audit_types, [type]: { ...defaultModelConfig.audit_types[type] } },
      audit_hours: { ...config.audit_hours, [type]: defaultHours },
      audit_hour_price: { ...config.audit_hour_price, [type]: defaultPrice },
    });
  };
  
  const computeAuditCost = (type: AuditTypeKey, hours: number, price: number) =>
    Math.max(0, Math.min(AUDIT_COST_MAX, hours * price));

  const updateAuditType = (type: AuditTypeKey, field: "effect" | "cost", value: number) => {
      const normalizedValue = field === "cost" ? Math.max(0, Math.min(AUDIT_COST_MAX, value)) : Math.max(0, value);
      updateConfig({
        audit_types: { ...config.audit_types, [type]: { ...config.audit_types[type], [field]: normalizedValue } },
      });
  };

  return (
    <div className="p-12 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-blue-600 px-2.5 py-1 bg-blue-50 rounded">Step 2</span>
          <h2 className="text-slate-900">Strategy Configuration</h2>
          <div className="flex-1" />
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
          >
            Reset to Defaults
          </button>
        </div>
        <p className="text-slate-600">
          Configure audit programs, communication channels, and the weekly tax calendar.
        </p>
      </div>

      <div className="space-y-6">
        {/* Simulation Horizon */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Simulation Horizon</h3>
            <Tooltip content="Number of weekly steps to simulate.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-slate-600">Simulation Length</label>
              <span className="text-blue-600">
                {(() => {
                  const years = config.steps / 52;
                  return `${config.steps} weeks · ${years.toString().replace(".", ",")} years`;
                })()}
              </span>
            </div>
            <input
              type="range"
              min="156"
              max="260"
              step="26"
              value={config.steps}
              onChange={(e) => updateConfig({ steps: Math.max(156, parseInt(e.target.value) || 156) })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1e293b 0%, #1e293b ${((config.steps - 156) / (260 - 156)) * 100}%, #e2e8f0 ${((config.steps - 156) / (260 - 156)) * 100}%, #e2e8f0 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>3 years</span>
              <span>4 years</span>
              <span>5 years</span>
            </div>
          </div>
        </div>

        {/* Reminder Strategy */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Reminder Strategy</h3>
            <Tooltip content="Automated reminders for tax filing deadlines.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>

          <div className="mb-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
              <label className="block text-slate-600 mb-3">Select Reminder Channels</label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={channelEmail}
                  onChange={(e) => handleChannelToggle("email", e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-slate-700">Email</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={channelLetter}
                  onChange={(e) => handleChannelToggle("letter", e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-slate-700">Letter</span>
              </label>
            </div>
          </div>

          <div className="space-y-6">
            {channelEmail && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center mb-4">
                  <span className="text-slate-900 font-medium">Email Configuration</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-slate-600 text-sm mb-2">Frequency</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      value={channelFrequency.email}
                      onChange={(e) => handleChannelFrequencyChange("email", parseFloat(e.target.value) || 1)}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #1e293b 0%, #1e293b ${
                          ((channelFrequency.email - 1) / 3) * 100
                        }%, #e2e8f0 ${((channelFrequency.email - 1) / 3) * 100}%, #e2e8f0 100%)`,
                      }}
                    />
                    <div className="text-slate-600 text-sm mt-1">{channelFrequency.email} times</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 text-sm mb-2">Cost per Unit (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={channelCost.email}
                      onChange={(e) => updateReminderChannelCost("email", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-700"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-slate-600 text-sm mb-2">Timing Configuration</div>
                  <div className="space-y-2">
                    {channelTimings.email.map((timing, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={timing.value}
                          onChange={(e) => updateChannelTiming("email", index, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-center"
                        />
                        <span className="text-slate-500 text-sm">weeks before deadline</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {channelLetter && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center mb-4">
                  <span className="text-slate-900 font-medium">Letter Configuration</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-slate-600 text-sm mb-2">Frequency</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      value={channelFrequency.letter}
                      onChange={(e) => handleChannelFrequencyChange("letter", parseFloat(e.target.value) || 1)}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #1e293b 0%, #1e293b ${
                          ((channelFrequency.letter - 1) / 3) * 100
                        }%, #e2e8f0 ${((channelFrequency.letter - 1) / 3) * 100}%, #e2e8f0 100%)`,
                      }}
                    />
                    <div className="text-slate-600 text-sm mt-1">{channelFrequency.letter} times</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 text-sm mb-2">Cost per Unit (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={channelCost.letter}
                      onChange={(e) => updateReminderChannelCost("letter", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-700"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-slate-600 text-sm mb-2">Timing Configuration</div>
                  <div className="space-y-2">
                    {channelTimings.letter.map((timing, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={timing.value}
                          onChange={(e) => updateChannelTiming("letter", index, parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-center"
                        />
                        <span className="text-slate-500 text-sm">weeks before deadline</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tax Calendar - Warning Visit Included but cost input removed */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-lg font-semibold">Tax Calendar</h3>
            <Tooltip content="All tax calendar weeks are defined within a 52-week calendar year and repeat each year.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-12">
            <div>
              <label className="block text-slate-700 mb-2">Tax Deadline Week</label>
              <input
                type="number"
                min="1"
                max="52"
                value={config.tax_deadline_week}
                onChange={(e) =>
                  updateConfig({ tax_deadline_week: Math.max(1, Math.min(52, parseInt(e.target.value) || 1)) })
                }
                className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-700"
                style={{ borderRadius: "12px", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)" }}
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-2">Audit Delay (weeks)</label>
              <input
                type="number"
                min="1"
                max="52"
                value={config.audit_delay_weeks}
                onChange={(e) =>
                  updateConfig({ audit_delay_weeks: Math.max(1, Math.min(52, parseInt(e.target.value) || 1)) })
                }
                className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-700"
                style={{ borderRadius: "12px", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)" }}
              />
            </div>

            {/* Warning Visit Week Input (Cost input removed) */}
            <div>
              <label className="block text-slate-700 mb-2">Warning Visit Week</label>
              <input
                type="number"
                min="1"
                max="52"
                value={warningVisitWeekInput}
                onChange={(e) => {
                  const next = e.target.value;
                  setWarningVisitWeekInput(next);
                  if (next !== "" && !Number.isNaN(parseInt(next))) {
                    updateConfig({ warning_visit_week: Math.max(1, Math.min(52, parseInt(next))) });
                  }
                }}
                placeholder="Optional"
                className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-700 placeholder:text-slate-400"
                style={{ borderRadius: "12px", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)" }}
              />
            </div>
          </div>

          <div className={styles.taxCalendarTimeline}>
            <div className="mb-4">
              <h4 className="text-slate-700 font-medium mb-2">Annual Timeline</h4>
            </div>

            <div className="relative">
              <div className={styles.weekMarkers}>
                <span>Week 1</span>
                <span>Week 13</span>
                <span>Week 26</span>
                <span>Week 39</span>
                <span>Week 52</span>
              </div>

              <div className={styles.timelineBar}>
                <div
                  className={styles.markerLine}
                  style={{
                    left: `${((config.tax_deadline_week - 1) / 51) * 100}%`,
                    background: "#2563eb",
                  }}
                >
                  <div className={styles.markerLabelWrap}>
                    <div className={styles.markerLabel} style={{ background: "#2563eb" }}>
                      Deadline (W{config.tax_deadline_week})
                    </div>
                  </div>
                </div>

                {config.tax_deadline_week + config.audit_delay_weeks <= 52 && (
                  <div
                    className={styles.markerLine}
                    style={{
                      left: `${((config.tax_deadline_week + config.audit_delay_weeks - 1) / 51) * 100}%`,
                      background: "#f97316",
                    }}
                  >
                    <div className={styles.markerLabelWrap}>
                      <div className={styles.markerLabel} style={{ background: "#f97316" }}>
                        Audit (W{config.tax_deadline_week + config.audit_delay_weeks})
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning Marker */}
                {warningVisitWeekInput !== "" &&
                  !Number.isNaN(parseInt(warningVisitWeekInput)) &&
                  parseInt(warningVisitWeekInput) >= 1 &&
                  parseInt(warningVisitWeekInput) <= 52 && (
                    <div
                      className={styles.markerLine}
                      style={{
                        left: `${((parseInt(warningVisitWeekInput) - 1) / 51) * 100}%`,
                        background: "#dc2626",
                      }}
                    >
                      <div className={styles.markerLabelWrap}>
                        <div className={styles.markerLabel} style={{ background: "#dc2626" }}>
                          Warning (W{parseInt(warningVisitWeekInput)})
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              <div className={styles.legend}>
                <div className={styles.legendItem}>
                  <div className={styles.legendSwatch} style={{ background: "#2563eb" }} />
                  <span>Tax Deadline</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendSwatch} style={{ background: "#f97316" }} />
                  <span>Audit Week</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendSwatch} style={{ background: "#dc2626" }} />
                  <span>Warning Visit</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Types & Rates & Run Sim Block (Kept exactly as before) */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Audit Types</h3>
            <Tooltip content="Define effect and cost inputs for Revenue tax, Corporate income tax, and Deep book audits.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {auditTypeOrder.map((type) => (
              <div key={type} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-slate-700 font-medium">{auditTypeLabels[type]}</div>
                  <button type="button" onClick={() => resetAuditType(type)} className="text-slate-500 hover:text-slate-900">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Hours per audit</label>
                    <input type="number" min="0" step="1" value={auditHours[type]}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value) || 0;
                        setAuditHours((prev) => ({ ...prev, [type]: next }));
                        const cost = computeAuditCost(type, next, auditHourPrice[type]);
                        updateAuditType(type, "cost", cost);
                        updateConfig({ audit_hours: { ...config.audit_hours, [type]: next } });
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">FTE hour price</label>
                    <input type="number" min="0" step="0.01" placeholder="60" value={auditHourPrice[type]}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value) || 0;
                        setAuditHourPrice((prev) => ({ ...prev, [type]: next }));
                        const cost = computeAuditCost(type, auditHours[type], next);
                        updateAuditType(type, "cost", cost);
                        updateConfig({ audit_hour_price: { ...config.audit_hour_price, [type]: next } });
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Rates */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Audit Rates by Segment</h3>
            <Tooltip content="Base weekly audit rate per size/age group (annualized during audit week).">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border border-slate-200 rounded-md">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-600 font-medium">Size \\ Age</th>
                  {ageOrder.map((age) => (<th key={age} className="px-4 py-3 text-left text-slate-600 font-medium">{age}</th>))}
                </tr>
              </thead>
              <tbody>
                {sizeOrder.map((size) => (
                  <tr key={size} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700 font-medium">{size}</td>
                    {ageOrder.map((age) => (
                      <td key={`${size}-${age}`} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" max={AUDIT_RATE_MAX * 100} step="0.01"
                            value={auditRateInputs[`${size}-${age}`] ?? (config.audit_rates[`${size}-${age}`] * 100).toFixed(2)}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setAuditRateInputs((prev) => ({ ...prev, [`${size}-${age}`]: nextValue }));
                            }}
                            onBlur={(e) => {
                              const parsed = parsePercentInput(e.target.value);
                              const pct = parsed === null ? 0 : parsed;
                              updateAuditRate(size, age, pct);
                              setAuditRateInputs((prev) => ({ ...prev, [`${size}-${age}`]: (Math.max(0, Math.min(AUDIT_RATE_MAX, pct / 100)) * 100).toFixed(2) }));
                            }}
                            className="w-24 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-sm"
                          />
                          <span className="text-slate-500 text-sm">%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Run Simulation */}
        <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Run Simulation</h3>
          </div>
          <div className="flex items-center justify-between gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={config.include_visualization ?? true}
                    onChange={(e) => updateConfig({ include_visualization: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-700 text-sm">Load network visualization</span>
                </label>
                <Tooltip content="Generates an animation of the network evolution (GIF).">
                  <Info className="w-4 h-4 text-slate-400 cursor-help" />
                </Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={multiRunEnabled}
                    onChange={(e) => updateConfig({ n_runs: e.target.checked ? Math.max(2, runCount) : 1 })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-700 text-sm">Run multiple simulations</span>
                </label>
                {multiRunEnabled && (
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-sm text-slate-500">Runs:</span>
                    <input type="number" min="2" max="50" step="1" value={runCount}
                      onChange={(e) => updateConfig({ n_runs: Math.max(2, Math.min(50, parseInt(e.target.value, 10) || 2)) })}
                      className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-center text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-200 min-w-[140px]">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Est. Runtime</span>
              </div>
              <div className="text-xl font-bold text-slate-700">{estimatedRuntimeLabel}</div>
            </div>
            <div className="flex flex-col items-end gap-3 min-w-[200px]">
              {isRunning && progress && progress.total > 0 && (
                <div className="w-full">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Step {progress.current}/{progress.total}</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                {isRunning && (
                  <button onClick={onInterrupt} className="px-4 py-2.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium">
                    Interrupt
                  </button>
                )}
                <button onClick={onRun} disabled={isRunning} className={`px-6 py-2.5 rounded-md flex items-center justify-center gap-2 font-medium transition-colors ${isRunning ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                  {isRunning ? "Running..." : "Start Simulation"}
                  {!isRunning && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
