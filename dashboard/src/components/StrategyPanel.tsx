import { useEffect, useState } from "react";
import { Info, AlertCircle, RotateCcw, ChevronRight } from "lucide-react";
import { Tooltip } from "./Tooltip";
import type { ModelConfig, SizeCategory, AgeCategory, AuditTypeKey } from "../data/modelTypes";
import { defaultModelConfig } from "../data/modelDefaults";
import styles from "./StrategyPanel.module.css";

interface StrategyPanelProps {
  config: ModelConfig;
  onConfigChange: (config: ModelConfig) => void;
  onRun: () => void;
  onInterrupt: () => void;
  isRunning: boolean;
  estimatedRuntimeMs: number | null;
}

const sizeOrder: SizeCategory[] = ["Micro", "Small", "Medium"];
const ageOrder: AgeCategory[] = ["Young", "Mature", "Old"];
const auditTypeOrder: AuditTypeKey[] = ["Light", "Standard", "Deep"];
const AUDIT_RATE_MAX = 0.05;
const AUDIT_COST_MAX = 5000;

type TimingUnit = "days" | "weeks" | "months";
type ChannelTiming = { value: number; unit: TimingUnit };

export function StrategyPanel({
  config,
  onConfigChange,
  onRun,
  onInterrupt,
  isRunning,
  estimatedRuntimeMs,
}: StrategyPanelProps) {
  const [auditRateInputs, setAuditRateInputs] = useState<Record<string, string>>({});
  const [auditHourPrice, setAuditHourPrice] = useState<Record<AuditTypeKey, number>>({
    Light: 20.11,
    Standard: 20.11,
    Deep: 20.11,
  });
  const [auditHours, setAuditHours] = useState<Record<AuditTypeKey, number>>({
    Light: Math.max(0, Math.round(defaultModelConfig.audit_types.Light.cost / 20.11)),
    Standard: Math.max(0, Math.round(defaultModelConfig.audit_types.Standard.cost / 20.11)),
    Deep: 78,
  });
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelLetter, setChannelLetter] = useState(false);
  const [channelSMS, setChannelSMS] = useState(false);
  const [channelWarningLetter, setChannelWarningLetter] = useState(false);
  const [channelFrequency, setChannelFrequency] = useState({
    email: 2,
    letter: 2,
    sms: 2,
  });
  const [channelCost, setChannelCost] = useState({
    email: config.intervention_costs.email,
    letter: config.intervention_costs.physical_letter,
    sms: 0,
    warningLetter: config.intervention_costs.warning_letter,
  });
  const [channelTimings, setChannelTimings] = useState<{
    email: ChannelTiming[];
    letter: ChannelTiming[];
    sms: ChannelTiming[];
  }>({
    email: [{ value: 2, unit: "weeks" }],
    letter: [{ value: 3, unit: "weeks" }],
    sms: [{ value: 5, unit: "days" }],
  });
  const [warningLetterTiming, setWarningLetterTiming] = useState<ChannelTiming>({
    value: 1,
    unit: "weeks",
  });
  const [warningVisitWeekInput, setWarningVisitWeekInput] = useState<string>(
    config.warning_visit_week ? String(config.warning_visit_week) : "",
  );

  const updateConfig = (partial: Partial<ModelConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  useEffect(() => {
    const formatted: Record<string, string> = {};
    Object.entries(config.audit_rates).forEach(([key, value]) => {
      formatted[key] = (value * 100).toFixed(2);
    });
    setAuditRateInputs(formatted);
  }, [config.audit_rates]);

  useEffect(() => {
    setWarningVisitWeekInput(config.warning_visit_week ? String(config.warning_visit_week) : "");
  }, [config.warning_visit_week]);

  useEffect(() => {
    setChannelCost((prev) => ({
      ...prev,
      email: config.intervention_costs.email,
      letter: config.intervention_costs.physical_letter,
      warningLetter: config.intervention_costs.warning_letter,
    }));
  }, [config.intervention_costs.email, config.intervention_costs.physical_letter, config.intervention_costs.warning_letter]);

  const updateAuditRate = (size: SizeCategory, age: AgeCategory, pct: number) => {
    const key = `${size}-${age}` as const;
    const rate = Math.max(0, Math.min(AUDIT_RATE_MAX, pct / 100));
    const updated = {
      ...config.audit_rates,
      [key]: rate,
    };
    updateConfig({ audit_rates: updated });
  };

  const updateAuditType = (type: AuditTypeKey, field: "effect" | "cost", value: number) => {
    const normalizedValue =
      field === "cost"
        ? Math.max(0, Math.min(AUDIT_COST_MAX, value))
        : Math.max(0, value);
    updateConfig({
      audit_types: {
        ...config.audit_types,
        [type]: {
          ...config.audit_types[type],
          [field]: normalizedValue,
        },
      },
    });
  };

  const resetAuditType = (type: AuditTypeKey) => {
    const defaultCost = defaultModelConfig.audit_types[type].cost;
    const defaultPrice = 20.11;
    const defaultHours = Math.max(0, Math.round(defaultCost / defaultPrice));
    setAuditHourPrice((prev) => ({ ...prev, [type]: defaultPrice }));
    setAuditHours((prev) => ({ ...prev, [type]: defaultHours }));
    updateConfig({
      audit_types: {
        ...config.audit_types,
        [type]: { ...defaultModelConfig.audit_types[type] },
      },
    });
  };

  const updateReminderChannelCost = (channel: "email" | "letter" | "warningLetter", value: number) => {
    const normalized = Math.max(0, value);
    setChannelCost((prev) => ({ ...prev, [channel]: normalized }));
    if (channel === "email") {
      updateConfig({
        intervention_costs: {
          ...config.intervention_costs,
          email: normalized,
        },
      });
      return;
    }
    if (channel === "letter") {
      updateConfig({
        intervention_costs: {
          ...config.intervention_costs,
          physical_letter: normalized,
        },
      });
      return;
    }
    updateConfig({
      intervention_costs: {
        ...config.intervention_costs,
        warning_letter: normalized,
      },
    });
  };

  const computeAuditCost = (type: AuditTypeKey, hours: number, price: number) =>
    Math.max(0, Math.min(AUDIT_COST_MAX, hours * price));

  const handleChannelFrequencyChange = (channel: "email" | "letter" | "sms", value: number) => {
    const next = Math.max(1, Math.min(4, value));
    setChannelFrequency((prev) => ({
      ...prev,
      [channel]: next,
    }));
    setChannelTimings((prev) => {
      const list = [...prev[channel]];
      if (list.length < next) {
        const toAdd = Array.from({ length: next - list.length }, () => ({ value: 1, unit: "weeks" as TimingUnit }));
        return { ...prev, [channel]: [...list, ...toAdd] };
      }
      if (list.length > next) {
        return { ...prev, [channel]: list.slice(0, next) };
      }
      return prev;
    });
  };

  const updateChannelTiming = (
    channel: "email" | "letter" | "sms",
    index: number,
    field: "value" | "unit",
    value: number | TimingUnit,
  ) => {
    setChannelTimings((prev) => {
      const list = [...prev[channel]];
      const entry = { ...list[index] };
      if (field === "value") {
        entry.value = typeof value === "number" ? value : entry.value;
      } else {
        entry.unit = value as TimingUnit;
      }
      list[index] = entry;
      return { ...prev, [channel]: list };
    });
  };

  return (
    <div className="p-12 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-blue-600 px-2.5 py-1 bg-blue-50 rounded">Step 2</span>
          <h2 className="text-slate-900">Strategy Configuration</h2>
        </div>
        <p className="text-slate-600">
          Configure audit programs, communication channels, and the weekly tax calendar.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Simulation Horizon</h3>
            <Tooltip content="Number of weekly steps to simulate (52 weeks per year).">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-slate-600">Simulation Length</label>
              <span className="text-blue-600">
                {config.steps} weeks · {Math.floor(config.steps / 52)} years {Math.round((config.steps % 52) / 4)} months
              </span>
            </div>
            <input
              type="range"
              min="156"
              max="260"
              step="4"
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
            {config.steps > 300 && (
              <div
                className="mt-4 flex items-center gap-2 text-red-700 border rounded-md"
                style={{
                  backgroundColor: "#fef2f2",
                  borderColor: "#fecaca",
                  padding: "12px 16px",
                }}
              >
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  Warning: simulations above 300 weeks may significantly increase runtime.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Reminder Strategy</h3>
            <Tooltip content="Automated reminders for tax filing deadlines.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>

          <div className="mb-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <label className="block text-slate-600 mb-3">Select Reminder Channels</label>
            <div className="grid grid-cols-4 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={channelEmail}
                  onChange={(e) => setChannelEmail(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-slate-700">Email</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={channelLetter}
                  onChange={(e) => setChannelLetter(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-slate-700">Letter</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={channelSMS}
                  onChange={(e) => setChannelSMS(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-slate-700">SMS</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={channelWarningLetter}
                  onChange={(e) => setChannelWarningLetter(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-slate-700">Warning Letter</span>
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
                      step="1"
                      value={channelFrequency.email}
                      onChange={(e) => handleChannelFrequencyChange("email", parseInt(e.target.value) || 1)}
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
                      onChange={(e) =>
                        updateReminderChannelCost("email", parseFloat(e.target.value) || 0)
                      }
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
                          max="12"
                          value={timing.value}
                          onChange={(e) =>
                            updateChannelTiming("email", index, "value", parseInt(e.target.value) || 1)
                          }
                          className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-center"
                        />
                        <select
                          value={timing.unit}
                          onChange={(e) =>
                            updateChannelTiming("email", index, "unit", e.target.value as TimingUnit)
                          }
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700"
                        >
                          <option value="days">days</option>
                          <option value="weeks">weeks</option>
                          <option value="months">months</option>
                        </select>
                        <span className="text-slate-500 text-sm">before deadline</span>
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
                      step="1"
                      value={channelFrequency.letter}
                      onChange={(e) => handleChannelFrequencyChange("letter", parseInt(e.target.value) || 1)}
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
                      onChange={(e) =>
                        updateReminderChannelCost("letter", parseFloat(e.target.value) || 0)
                      }
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
                          max="12"
                          value={timing.value}
                          onChange={(e) =>
                            updateChannelTiming("letter", index, "value", parseInt(e.target.value) || 1)
                          }
                          className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-center"
                        />
                        <select
                          value={timing.unit}
                          onChange={(e) =>
                            updateChannelTiming("letter", index, "unit", e.target.value as TimingUnit)
                          }
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700"
                        >
                          <option value="days">days</option>
                          <option value="weeks">weeks</option>
                          <option value="months">months</option>
                        </select>
                        <span className="text-slate-500 text-sm">before deadline</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {channelSMS && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center mb-4">
                  <span className="text-slate-900 font-medium">SMS Configuration</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-slate-600 text-sm mb-2">Frequency</label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="1"
                      value={channelFrequency.sms}
                      onChange={(e) => handleChannelFrequencyChange("sms", parseInt(e.target.value) || 1)}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #1e293b 0%, #1e293b ${
                          ((channelFrequency.sms - 1) / 3) * 100
                        }%, #e2e8f0 ${((channelFrequency.sms - 1) / 3) * 100}%, #e2e8f0 100%)`,
                      }}
                    />
                    <div className="text-slate-600 text-sm mt-1">{channelFrequency.sms} times</div>
                  </div>
                  <div>
                    <label className="block text-slate-600 text-sm mb-2">Cost per Unit (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={channelCost.sms}
                      onChange={(e) => setChannelCost({ ...channelCost, sms: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-700"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-slate-600 text-sm mb-2">Timing Configuration</div>
                  <div className="space-y-2">
                    {channelTimings.sms.map((timing, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={timing.value}
                          onChange={(e) =>
                            updateChannelTiming("sms", index, "value", parseInt(e.target.value) || 1)
                          }
                          className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-center"
                        />
                        <select
                          value={timing.unit}
                          onChange={(e) =>
                            updateChannelTiming("sms", index, "unit", e.target.value as TimingUnit)
                          }
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700"
                        >
                          <option value="days">days</option>
                          <option value="weeks">weeks</option>
                          <option value="months">months</option>
                        </select>
                        <span className="text-slate-500 text-sm">before deadline</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {channelWarningLetter && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center mb-4">
                  <span className="text-slate-900 font-medium">Warning Letter Configuration</span>
                </div>

                <div className="mb-4">
                  <label className="block text-slate-600 text-sm mb-2">Cost per Unit (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={channelCost.warningLetter}
                    onChange={(e) =>
                      updateReminderChannelCost("warningLetter", parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-700"
                  />
                </div>

                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="text-slate-600 text-sm mb-2">Timing Configuration</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={warningLetterTiming.value}
                      onChange={(e) =>
                        setWarningLetterTiming({
                          ...warningLetterTiming,
                          value: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-center"
                    />
                    <select
                      value={warningLetterTiming.unit}
                      onChange={(e) =>
                        setWarningLetterTiming({
                          ...warningLetterTiming,
                          unit: e.target.value as TimingUnit,
                        })
                      }
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700"
                    >
                      <option value="days">days</option>
                      <option value="weeks">weeks</option>
                      <option value="months">months</option>
                    </select>
                    <span className="text-slate-500 text-sm">before deadline</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>


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
                  if (next === "") {
                    return;
                  }
                  updateConfig({
                    warning_visit_week: Math.max(1, Math.min(52, parseInt(next) || 1)),
                  });
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
              <p className="text-slate-500 text-sm">Visual representation of tax events across 52 weeks</p>
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

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Audit Types</h3>
            <Tooltip content="Define effect and cost inputs for Light, Standard, and Deep audits.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {auditTypeOrder.map((type) => (
              <div key={type} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-slate-700 font-medium">{type}</div>
                  <button
                    type="button"
                    onClick={() => resetAuditType(type)}
                    className="text-slate-500 hover:text-slate-900"
                    aria-label="Reset to default"
                    title="Reset to default"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Hours per audit</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={auditHours[type]}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value) || 0;
                        setAuditHours((prev) => ({ ...prev, [type]: next }));
                        const cost = computeAuditCost(type, next, auditHourPrice[type]);
                        updateAuditType(type, "cost", cost);
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">FTE hour price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={auditHourPrice[type]}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value) || 0;
                        setAuditHourPrice((prev) => ({ ...prev, [type]: next }));
                        const cost = computeAuditCost(type, auditHours[type], next);
                        updateAuditType(type, "cost", cost);
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

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
                  {ageOrder.map((age) => (
                    <th key={age} className="px-4 py-3 text-left text-slate-600 font-medium">
                      {age}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizeOrder.map((size) => (
                  <tr key={size} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-700 font-medium">{size}</td>
                    {ageOrder.map((age) => (
                      <td key={`${size}-${age}`} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={AUDIT_RATE_MAX * 100}
                            step="0.01"
                            value={auditRateInputs[`${size}-${age}`] ?? (config.audit_rates[`${size}-${age}`] * 100).toFixed(2)}
                            onChange={(e) =>
                              setAuditRateInputs((prev) => ({
                                ...prev,
                                [`${size}-${age}`]: e.target.value,
                              }))
                            }
                            onBlur={(e) => {
                              const raw = parseFloat(e.target.value);
                              const pct = Number.isNaN(raw) ? 0 : raw;
                              updateAuditRate(size, age, pct);
                              setAuditRateInputs((prev) => ({
                                ...prev,
                                [`${size}-${age}`]: (Math.max(0, Math.min(AUDIT_RATE_MAX, pct / 100)) * 100).toFixed(2),
                              }));
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

      </div>

      <div className="mt-8 flex justify-end">
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-500">
            Estimated runtime:{" "}
            <span className="text-slate-900">
              {estimatedRuntimeMs !== null ? `${(estimatedRuntimeMs / 1000).toFixed(2)}s` : "—"}
            </span>
          </div>
          {isRunning && (
            <button
              onClick={onInterrupt}
              className="px-5 py-2.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Interrupt
            </button>
          )}
          <button
            onClick={onRun}
            disabled={isRunning}
            className={`px-6 py-2.5 rounded-md flex items-center gap-2 ${
              isRunning
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isRunning ? "Running Simulation..." : "Run Simulation"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
