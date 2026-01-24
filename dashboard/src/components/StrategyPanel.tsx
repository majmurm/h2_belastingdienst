import { Info, ChevronRight } from "lucide-react";
import { Tooltip } from "./Tooltip";
import type { ModelConfig, SizeCategory, AgeCategory, AuditTypeKey, ChannelKey } from "../data/modelTypes";

interface StrategyPanelProps {
  config: ModelConfig;
  onConfigChange: (config: ModelConfig) => void;
  onRun: () => void;
  isRunning: boolean;
  estimatedRuntimeMs: number | null;
}

const sizeOrder: SizeCategory[] = ["Micro", "Small", "Medium"];
const ageOrder: AgeCategory[] = ["Young", "Mature", "Old"];
const auditTypeOrder: AuditTypeKey[] = ["Light", "Standard", "Deep"];
const channelOrder: ChannelKey[] = ["physical_letter", "email", "warning_letter"];

const channelLabels: Record<ChannelKey, string> = {
  physical_letter: "Physical Letter",
  email: "Email",
  warning_letter: "Warning Letter",
};

export function StrategyPanel({ config, onConfigChange, onRun, isRunning, estimatedRuntimeMs }: StrategyPanelProps) {
  const updateConfig = (partial: Partial<ModelConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  const updateAuditRate = (size: SizeCategory, age: AgeCategory, pct: number) => {
    const key = `${size}-${age}` as const;
    const updated = {
      ...config.audit_rates,
      [key]: Math.max(0, Math.min(1, pct / 100)),
    };
    updateConfig({ audit_rates: updated });
  };

  const updateAuditType = (type: AuditTypeKey, field: "effect" | "cost", value: number) => {
    updateConfig({
      audit_types: {
        ...config.audit_types,
        [type]: {
          ...config.audit_types[type],
          [field]: value,
        },
      },
    });
  };

  const updateChannel = (channel: ChannelKey, field: "effect" | "cost", value: number) => {
    if (field === "effect") {
      updateConfig({
        channel_effects: {
          ...config.channel_effects,
          [channel]: value,
        },
      });
      return;
    }
    updateConfig({
      intervention_costs: {
        ...config.intervention_costs,
        [channel]: value,
      },
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
              min="104"
              max="416"
              step="4"
              value={config.steps}
              onChange={(e) => updateConfig({ steps: Math.max(104, parseInt(e.target.value) || 104) })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1e293b 0%, #1e293b ${((config.steps - 104) / (416 - 104)) * 100}%, #e2e8f0 ${((config.steps - 104) / (416 - 104)) * 100}%, #e2e8f0 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>2 years</span>
              <span>5 years</span>
              <span>8 years</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Tax Calendar</h3>
            <Tooltip content="Controls when reminders, audits, and visits occur within each 52-week cycle.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="text-slate-600 text-sm mb-2 block">Tax Deadline Week</label>
              <input
                type="number"
                min="1"
                max="52"
                value={config.tax_deadline_week}
                onChange={(e) => updateConfig({ tax_deadline_week: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
              />
            </div>
            <div>
              <label className="text-slate-600 text-sm mb-2 block">Audit Delay (weeks)</label>
              <input
                type="number"
                min="0"
                max="52"
                value={config.audit_delay_weeks}
                onChange={(e) => updateConfig({ audit_delay_weeks: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
              />
            </div>
            <div>
              <label className="text-slate-600 text-sm mb-2 block">Warning Visit Week</label>
              <input
                type="number"
                min="1"
                max="52"
                value={config.warning_visit_week}
                onChange={(e) => updateConfig({ warning_visit_week: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Audit Types</h3>
            <Tooltip content="Define effect and cost for Light, Standard, and Deep audits.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {auditTypeOrder.map((type) => (
              <div key={type} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="text-slate-700 font-medium mb-3">{type}</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Effect</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.audit_types[type].effect}
                      onChange={(e) => updateAuditType(type, "effect", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Cost (EUR)</label>
                    <input
                      type="number"
                      step="1"
                      value={config.audit_types[type].cost}
                      onChange={(e) => updateAuditType(type, "cost", parseFloat(e.target.value) || 0)}
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
            <h3 className="text-slate-900 text-md font-medium">Communication Channels</h3>
            <Tooltip content="Define effect and cost for each channel used in the tax calendar.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {channelOrder.map((channel) => (
              <div key={channel} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="text-slate-700 font-medium mb-3">{channelLabels[channel]}</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Effect</label>
                    <input
                      type="number"
                      step="0.001"
                      value={config.channel_effects[channel]}
                      onChange={(e) => updateChannel(channel, "effect", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 text-sm block mb-1">Cost (EUR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.intervention_costs[channel]}
                      onChange={(e) => updateChannel(channel, "cost", parseFloat(e.target.value) || 0)}
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
                            max="100"
                            step="0.01"
                            value={(config.audit_rates[`${size}-${age}`] * 100).toFixed(2)}
                            onChange={(e) =>
                              updateAuditRate(size, age, parseFloat(e.target.value) || 0)
                            }
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

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Compliance Decay</h3>
            <Tooltip content="Weekly decay in compliance propensity absent interventions.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="max-w-sm">
            <input
              type="number"
              step="0.00001"
              value={config.decay_factor}
              onChange={(e) => updateConfig({ decay_factor: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
            />
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
