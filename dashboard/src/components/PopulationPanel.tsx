import { ChevronRight, Info, AlertCircle, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip } from "./Tooltip";
import type { ModelConfig, SizeCategory, AgeCategory, SectorKey } from "../data/modelTypes";
import { defaultModelConfig } from "../data/modelDefaults";
import sectorDefaults from "../data/sectorDefaults.json";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface PopulationPanelProps {
  config: ModelConfig;
  onConfigChange: (config: ModelConfig) => void;
  onNext: () => void;
}

const sizeOrder: SizeCategory[] = ["Micro", "Small", "Medium"];
const ageOrder: AgeCategory[] = ["Young", "Mature", "Old"];
const selectAllLabel = "All" as const;

const sectorList = sectorDefaults.sectors_individual as SectorKey[];
const individualSectors = sectorDefaults.sectors_individual as SectorKey[];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function PopulationPanel({ config, onConfigChange, onNext }: PopulationPanelProps) {
  const [distributionType, setDistributionType] = useState<"reallife" | "manual">("manual");
  const [openSections, setOpenSections] = useState<{ size: boolean; age: boolean }>({
    size: false,
    age: false,
  });
  const [previousSelection, setPreviousSelection] = useState<SectorKey[]>(config.selected_sectors);
  const TOTAL_REAL_LIFE_POPULATION = 1630865;
  const selectedSectorShare = config.selected_sectors.reduce((sum, sector) => {
    const share = (sectorDefaults.sector_shares as Record<SectorKey, number>)[sector] ?? 0;
    return sum + share;
  }, 0);
  const effectiveSectorShare = selectedSectorShare > 0 ? selectedSectorShare : 1;
  const realLifePopulation = Math.round(TOTAL_REAL_LIFE_POPULATION * effectiveSectorShare);
  const updateConfig = (partial: Partial<ModelConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  const isAllSelected = individualSectors.every((sector) =>
    config.selected_sectors.includes(sector),
  );

  const computeSectorShares = (selected: SectorKey[]) => {
    const shares = sectorDefaults.sector_shares as Record<SectorKey, number>;
    const total = selected.reduce((sum, sector) => sum + (shares[sector] ?? 0), 0);
    if (total <= 0) {
      return selected.reduce<Record<SectorKey, number>>((acc, sector) => {
        acc[sector] = 0;
        return acc;
      }, {} as Record<SectorKey, number>);
    }
    const normalized = selected.reduce<Record<SectorKey, number>>((acc, sector) => {
      acc[sector] = (shares[sector] ?? 0) / total;
      return acc;
    }, {} as Record<SectorKey, number>);
    
    // CHANGED: Removed the logic that added the 'Business Economy' total key
    return normalized;
  };

  const computeSizeSharesFromSectors = (selected: SectorKey[]) => {
    const bySector = sectorDefaults.size_shares_by_sector as Record<
      SectorKey,
      Record<SizeCategory, number>
    >;
    const sectorShares = computeSectorShares(selected);
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
    if (total <= 0) {
      return totals;
    }
    return {
      Micro: totals.Micro / total,
      Small: totals.Small / total,
      Medium: totals.Medium / total,
    };
  };


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
        size_shares: computeSizeSharesFromSectors(config.selected_sectors),
        age_shares: { ...defaultModelConfig.age_shares },
      });
    }
  };

  const agentPopulationSize = config.N;
  const agentPopulationPercentage = realLifePopulation > 0 ? (config.N / realLifePopulation) * 100 : 0;
  const clampedPercentage = Math.max(0.1, Math.min(5, agentPopulationPercentage));

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
            <h3 className="text-slate-900 text-md font-medium">Business Sectors</h3>
            <Tooltip content="Select sectors to compute sector-weighted size shares and run sector-specific reporting.">
              <Info className="w-4 h-4 text-slate-400 cursor-help" />
            </Tooltip>
          </div>
          <div className="space-y-4">
            {[selectAllLabel].map((sector) => {
              const checked = isAllSelected;
              return (
                <label
                  key={sector}
                  className={`flex items-center justify-between gap-3 p-4 border rounded-md ${
                    checked
                      ? "bg-blue-100 border-blue-300 text-blue-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          setPreviousSelection(config.selected_sectors);
                          updateConfig({
                            selected_sectors: [],
                            sector_shares: computeSectorShares([]),
                          });
                          return;
                        }
                        const next = [...individualSectors];
                        const sectorShares = computeSectorShares(next);
                        const nextConfig: Partial<ModelConfig> = {
                          selected_sectors: next,
                          sector_shares: sectorShares,
                        };
                        if (distributionType === "reallife") {
                          nextConfig.size_shares = computeSizeSharesFromSectors(next);
                        }
                        updateConfig(nextConfig);
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium">All sectors</span>
                  </div>
                  <span className="text-xs">100%</span>
                </label>
              );
            })}

            <div className="grid grid-cols-2 gap-4">
              {sectorList.map((sector) => {
                const checked = config.selected_sectors.includes(sector);
                const sectorShare = config.sector_shares[sector as SectorKey] ?? 0;
                return (
                  <label
                    key={sector}
                    className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-md bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? config.selected_sectors.filter((item) => item !== sector)
                            : [...config.selected_sectors, sector];

                          if (next.length === 0) return;

                          const sectorShares = computeSectorShares(next);
                          const nextConfig: Partial<ModelConfig> = {
                            selected_sectors: next,
                            sector_shares: sectorShares,
                          };

                          if (distributionType === "reallife") {
                            nextConfig.size_shares = computeSizeSharesFromSectors(next);
                          }

                          updateConfig(nextConfig);
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-slate-700 text-sm">{sector}</span>
                    </div>
                    <span className="text-slate-500 text-xs">
                      {(sectorShare * 100).toFixed(1)}%
                    </span>
                  </label>
                );
              })}
            </div>
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
                {realLifePopulation.toLocaleString()} enterprises
              </span>
            </div>
            <p className="text-blue-700 text-sm">
              Reference population based on selected business sectors.
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-slate-700 font-medium">Agent Population (% of real-life population)</label>
              <span className="text-blue-600 font-medium">{agentPopulationPercentage.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={clampedPercentage}
              onChange={(e) => {
                const percent = parseFloat(e.target.value);
                if (Number.isNaN(percent)) return;
                updateConfig({ N: Math.max(1, Math.round((realLifePopulation * percent) / 100)) });
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1e293b 0%, #1e293b ${((clampedPercentage - 0.1) / (5 - 0.1)) * 100}%, #e2e8f0 ${((clampedPercentage - 0.1) / (5 - 0.1)) * 100}%, #e2e8f0 100%)`
              }}
            />
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>0.1%</span>
              <span>1%</span>
              <span>2%</span>
              <span>3%</span>
              <span>4%</span>
              <span>5%</span>
            </div>
            <p className="text-slate-500 mt-3">
              Select between 0.1% and 5% of the real-life population for simulation. Larger populations increase accuracy but require more computational resources.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-slate-700 font-medium mb-2">Exact Agent Count</label>
            <input
              type="number"
              min="1"
              step="1"
              value={config.N}
              onChange={(e) => {
                const next = Math.max(1, Math.floor(parseInt(e.target.value, 10) || 1));
                updateConfig({ N: next });
              }}
              className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-700"
              style={{ borderRadius: "12px", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)" }}
            />
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
                  1:{agentPopulationPercentage > 0 ? Math.round(100 / agentPopulationPercentage) : "—"}
                </div>
                <div className="text-slate-500 text-sm mt-1">
                  each agent represents ~
                  {agentPopulationPercentage > 0 ? Math.round(100 / agentPopulationPercentage) : "—"} enterprises
                </div>
              </div>
            </div>
            {agentPopulationSize > 50000 && (
              <div
                className="mt-8 flex items-center gap-2 text-red-700 border rounded-md"
                style={{
                  backgroundColor: "#fef2f2",
                  borderColor: "#fecaca",
                  padding: "12px 16px",
                }}
              >
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  Warning: populations above 50,000 may significantly increase runtime.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-6">Enterprise Characteristics Distribution (Manual Selection)</h3>
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
