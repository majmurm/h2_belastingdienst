import { ChevronRight, Info, AlertCircle, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Tooltip } from "./Tooltip";
import type { ModelConfig, SizeCategory, AgeCategory } from "../data/modelTypes";
import { defaultModelConfig } from "../data/modelDefaults";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface PopulationPanelProps {
  config: ModelConfig;
  onConfigChange: (config: ModelConfig) => void;
  onNext: () => void;
}

const sizeOrder: SizeCategory[] = ["Micro", "Small", "Medium"];
const ageOrder: AgeCategory[] = ["Young", "Mature", "Old"];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const KAPPA_MIN = 50;
const KAPPA_MAX = 1000;
const SEED_MIN = 0;
const SEED_MAX = 2_147_483_647;
const GRADIENT_MIN = -0.15;
const GRADIENT_MAX = 0.15;

export function PopulationPanel({ config, onConfigChange, onNext }: PopulationPanelProps) {
  const [distributionType, setDistributionType] = useState<"reallife" | "manual">("reallife");
  const [openSections, setOpenSections] = useState<{ size: boolean; age: boolean }>({
    size: false,
    age: false,
  });
  const REAL_LIFE_POPULATION = 423735;
  const initialPercent = Math.max(
    1,
    Math.min(25, Math.round((config.N / REAL_LIFE_POPULATION) * 100)),
  );
  const [agentPopulationPercentage, setAgentPopulationPercentage] = useState(initialPercent);

  const updateConfig = (partial: Partial<ModelConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  const clampGradient = (value: number) => Math.max(GRADIENT_MIN, Math.min(GRADIENT_MAX, value));
  const clampKappa = (value: number) => Math.max(KAPPA_MIN, Math.min(KAPPA_MAX, value));
  const clampSeed = (value: number) => Math.max(SEED_MIN, Math.min(SEED_MAX, value));

  const updateShare = (
    key: SizeCategory | AgeCategory,
    value: number,
    field: "size_shares" | "age_shares",
  ) => {
    const updated = {
      ...config[field],
      [key]: clamp01(value / 100),
    };
    updateConfig({ [field]: updated } as Partial<ModelConfig>);
  };

  const toggleSection = (section: "size" | "age") => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleDistributionTypeChange = (type: "reallife" | "manual") => {
    setDistributionType(type);
    if (type === "reallife") {
      updateConfig({
        size_shares: { ...defaultModelConfig.size_shares },
        age_shares: { ...defaultModelConfig.age_shares },
      });
    }
  };

  const agentPopulationSize = useMemo(
    () => Math.round((REAL_LIFE_POPULATION * agentPopulationPercentage) / 100),
    [agentPopulationPercentage, REAL_LIFE_POPULATION],
  );

  const sizeTotal = Object.values(config.size_shares).reduce((sum, val) => sum + val, 0);
  const ageTotal = Object.values(config.age_shares).reduce((sum, val) => sum + val, 0);

  return (
    <div className="p-12 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-blue-600 px-2.5 py-1 bg-blue-50 rounded">Step 1</span>
          <h2 className="text-slate-900">Population Configuration</h2>
        </div>
        <p className="text-slate-600">
          Configure the synthetic SME population that seeds the model.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-6">Population Distribution</h3>
          <div className="flex gap-4">
            <button
              onClick={() => handleDistributionTypeChange("reallife")}
              className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                distributionType === "reallife"
                  ? "border-blue-600 bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-medium mb-1">Real-life Distribution</div>
              <div className="text-sm opacity-75">Use default Dutch enterprise shares</div>
            </button>
            <button
              onClick={() => handleDistributionTypeChange("manual")}
              className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                distributionType === "manual"
                  ? "border-blue-600 bg-blue-50 text-blue-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-medium mb-1">Manual Distribution</div>
              <div className="text-sm opacity-75">Customize size and age shares</div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Population Size</h3>
            <Tooltip content="Select the number of agents to simulate based on a real-life reference population.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-900 font-medium">Real-life Population Size</span>
              <span className="text-blue-900 font-bold text-lg">
                {REAL_LIFE_POPULATION.toLocaleString()} enterprises
              </span>
            </div>
            <p className="text-blue-700 text-sm">
              Reference population used to compute agent sampling.
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-slate-700 font-medium">Agent Population (% of real-life population)</label>
              <span className="text-blue-600 font-medium">{agentPopulationPercentage}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="25"
              step="1"
              value={agentPopulationPercentage}
              onChange={(e) => {
                const percent = parseInt(e.target.value);
                setAgentPopulationPercentage(percent);
                updateConfig({ N: Math.max(100, Math.round((REAL_LIFE_POPULATION * percent) / 100)) });
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1e293b 0%, #1e293b ${((agentPopulationPercentage - 1) / 24) * 100}%, #e2e8f0 ${((agentPopulationPercentage - 1) / 24) * 100}%, #e2e8f0 100%)`
              }}
            />
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>1%</span>
              <span>5%</span>
              <span>10%</span>
              <span>15%</span>
              <span>20%</span>
              <span>25%</span>
            </div>
            <p className="text-slate-500 mt-3">
              Select between 1% and 25% of the real-life population for simulation. Larger populations increase accuracy but require more computational resources.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-slate-600 mb-1">Agent Population Size</div>
                <div className="text-slate-900 font-bold text-2xl">
                  {agentPopulationSize.toLocaleString()}
                </div>
                <div className="text-slate-500 text-sm mt-1">agents to simulate</div>
              </div>
              <div>
                <div className="text-slate-600 mb-1">Representation Ratio</div>
                <div className="text-slate-900 font-bold text-2xl">
                  1:{Math.round(100 / agentPopulationPercentage)}
                </div>
                <div className="text-slate-500 text-sm mt-1">
                  each agent represents ~{Math.round(100 / agentPopulationPercentage)} enterprises
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-6">Enterprise Characteristics Distribution</h3>
          <div className="space-y-4">
            <Collapsible open={openSections.size} onOpenChange={() => toggleSection("size")}>
              <div className="border border-slate-200 rounded-md">
                <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors rounded-md">
                  <span className="text-slate-700">Enterprise Size Distribution</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${openSections.size ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 py-4">
                  <div className="space-y-4">
                    {sizeOrder.map((size) => (
                      <div key={size}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-slate-600">{size}</label>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={(config.size_shares[size] * 100).toFixed(1)}
                                onChange={(e) => updateShare(size, parseFloat(e.target.value) || 0, "size_shares")}
                                disabled={distributionType === "reallife"}
                                className="w-12 bg-transparent text-slate-700 text-sm text-right outline-none disabled:text-slate-400"
                              />
                              <span className="text-slate-400 text-xs">%</span>
                            </div>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.1"
                          value={parseFloat((config.size_shares[size] * 100).toFixed(1))}
                          onChange={(e) => updateShare(size, parseFloat(e.target.value), "size_shares")}
                          disabled={distributionType === "reallife"}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #1e293b 0%, #1e293b ${config.size_shares[size] * 100}%, #e2e8f0 ${config.size_shares[size] * 100}%, #e2e8f0 100%)`,
                          }}
                        />
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-slate-500">Total</span>
                      <span className={`font-medium ${Math.abs(sizeTotal - 1) < 0.001 ? "text-slate-900" : "text-amber-600"}`}>
                        {(sizeTotal * 100).toFixed(1)}%
                      </span>
                    </div>
                    {Math.abs(sizeTotal - 1) >= 0.001 && (
                      <div className="flex items-center gap-2 pt-2 text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">Total must equal 100%. Please adjust the distribution.</span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <Collapsible open={openSections.age} onOpenChange={() => toggleSection("age")}>
              <div className="border border-slate-200 rounded-md">
                <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors rounded-md">
                  <span className="text-slate-700">Enterprise Age Distribution</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${openSections.age ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 py-4">
                  <div className="space-y-4">
                    {ageOrder.map((age) => (
                      <div key={age}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-slate-600">{age}</label>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={(config.age_shares[age] * 100).toFixed(1)}
                                onChange={(e) => updateShare(age, parseFloat(e.target.value) || 0, "age_shares")}
                                disabled={distributionType === "reallife"}
                                className="w-12 bg-transparent text-slate-700 text-sm text-right outline-none disabled:text-slate-400"
                              />
                              <span className="text-slate-400 text-xs">%</span>
                            </div>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.1"
                          value={parseFloat((config.age_shares[age] * 100).toFixed(1))}
                          onChange={(e) => updateShare(age, parseFloat(e.target.value), "age_shares")}
                          disabled={distributionType === "reallife"}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #1e293b 0%, #1e293b ${config.age_shares[age] * 100}%, #e2e8f0 ${config.age_shares[age] * 100}%, #e2e8f0 100%)`,
                          }}
                        />
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-slate-500">Total</span>
                      <span className={`font-medium ${Math.abs(ageTotal - 1) < 0.001 ? "text-slate-900" : "text-amber-600"}`}>
                        {(ageTotal * 100).toFixed(1)}%
                      </span>
                    </div>
                    {Math.abs(ageTotal - 1) >= 0.001 && (
                      <div className="flex items-center gap-2 pt-2 text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">Total must equal 100%. Please adjust the distribution.</span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-slate-900 text-md font-medium">Baseline Compliance Targets</h3>
            <Tooltip content="Controls the mean compliance propensity before behavioral dynamics are applied.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-600">
                  Target Mean Propensity (C_target)
                </label>
                <span className="text-blue-600">{config.C_target.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.9"
                step="0.001"
                value={config.C_target}
                onChange={(e) => updateConfig({ C_target: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #1e293b 0%, #1e293b ${((config.C_target - 0.5) / 0.4) * 100}%, #e2e8f0 ${((config.C_target - 0.5) / 0.4) * 100}%, #e2e8f0 100%)`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-slate-600">Size Gradient (m_size)</label>
                  <Tooltip content="Adjusts how compliance shifts across size categories.">
                    <Info className="w-4 h-4 text-slate-400 cursor-help" />
                  </Tooltip>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={GRADIENT_MIN}
                  max={GRADIENT_MAX}
                  value={config.m_size}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    if (Number.isNaN(next)) return;
                    updateConfig({ m_size: next });
                  }}
                  onBlur={(e) =>
                    updateConfig({ m_size: clampGradient(parseFloat(e.target.value) || 0) })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-slate-600">Age Gradient (m_age)</label>
                  <Tooltip content="Adjusts how compliance shifts across age categories.">
                    <Info className="w-4 h-4 text-slate-400 cursor-help" />
                  </Tooltip>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={GRADIENT_MIN}
                  max={GRADIENT_MAX}
                  value={config.m_age}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    if (Number.isNaN(next)) return;
                    updateConfig({ m_age: next });
                  }}
                  onBlur={(e) =>
                    updateConfig({ m_age: clampGradient(parseFloat(e.target.value) || 0) })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-slate-600">Dispersion (kappa)</label>
                  <Tooltip content="Higher values tighten the beta distribution around the mean.">
                    <Info className="w-4 h-4 text-slate-400 cursor-help" />
                  </Tooltip>
                </div>
                <input
                  type="number"
                  min={KAPPA_MIN}
                  max={KAPPA_MAX}
                  step="1"
                  value={config.kappa}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10);
                    if (Number.isNaN(next)) return;
                    updateConfig({ kappa: next });
                  }}
                  onBlur={(e) =>
                    updateConfig({ kappa: clampKappa(parseInt(e.target.value, 10) || KAPPA_MIN) })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-slate-600">Random Seed</label>
                  <Tooltip content="Controls random draws for reproducibility.">
                    <Info className="w-4 h-4 text-slate-400 cursor-help" />
                  </Tooltip>
                </div>
                <input
                  type="number"
                  min={SEED_MIN}
                  max={SEED_MAX}
                  step="1"
                  value={config.seed}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10);
                    if (Number.isNaN(next)) return;
                    updateConfig({ seed: next });
                  }}
                  onBlur={(e) =>
                    updateConfig({ seed: clampSeed(parseInt(e.target.value, 10) || 0) })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          Continue to Strategy Selection
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
