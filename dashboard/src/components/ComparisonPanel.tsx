import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { RunRecord } from '../data/runHistory';

interface ComparisonPanelProps {
  runs: RunRecord[];
  initialRunIds?: [string, string];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    value,
  );

export function ComparisonPanel({ runs, initialRunIds }: ComparisonPanelProps) {
  const fallbackIds: [string, string] = runs.length >= 2
    ? [runs[0].id, runs[1].id]
    : runs.length === 1
    ? [runs[0].id, runs[0].id]
    : ["", ""];
  const [strategyAId, setStrategyAId] = useState<string>(initialRunIds?.[0] ?? fallbackIds[0]);
  const [strategyBId, setStrategyBId] = useState<string>(initialRunIds?.[1] ?? fallbackIds[1]);
  const [showStrategyAParams, setShowStrategyAParams] = useState(false);
  const [showStrategyBParams, setShowStrategyBParams] = useState(false);

  const strategyA = useMemo(() => runs.find(r => r.id === strategyAId), [runs, strategyAId]);
  const strategyB = useMemo(() => runs.find(r => r.id === strategyBId), [runs, strategyBId]);

  useEffect(() => {
    if (!strategyAId && fallbackIds[0]) {
      setStrategyAId(fallbackIds[0]);
    }
    if (!strategyBId && fallbackIds[1]) {
      setStrategyBId(fallbackIds[1]);
    }
  }, [fallbackIds, strategyAId, strategyBId]);

  if (runs.length === 0) {
    return <div className="p-12">No runs available for comparison.</div>;
  }

  if (!strategyA || !strategyB) {
    return <div className="p-12">Select two runs to compare.</div>;
  }

  const complianceData = [
    {
      metric: "Final Compliance (%)",
      strategyA: strategyA.summary.finalMean * 100,
      strategyB: strategyB.summary.finalMean * 100,
    },
    {
      metric: "Delta Mean",
      strategyA: strategyA.summary.deltaMean,
      strategyB: strategyB.summary.deltaMean,
    },
  ];

  const financialData = [
    {
      metric: "Tax Gap Reduction",
      strategyA: strategyA.summary.taxGapReduction,
      strategyB: strategyB.summary.taxGapReduction,
    },
    {
      metric: "Total Cost",
      strategyA: strategyA.summary.totalCost,
      strategyB: strategyB.summary.totalCost,
    },
    {
      metric: "Net Benefit",
      strategyA: strategyA.summary.netBenefit,
      strategyB: strategyB.summary.netBenefit,
    },
    {
      metric: "ROI Ratio",
      strategyA: strategyA.summary.roiRatio,
      strategyB: strategyB.summary.roiRatio,
    },
  ];

  const complianceDiff = (strategyA.summary.finalMean - strategyB.summary.finalMean) * 100;
  const gapDiff = strategyA.summary.taxGapReduction - strategyB.summary.taxGapReduction;

  return (
    <div className="p-12 max-w-6xl">
      <div className="mb-8">
        <h2 className="text-slate-900 mb-3">Strategy Comparison</h2>
        <p className="text-slate-600">
          Compare two strategies side-by-side to choose the best approach
        </p>
      </div>

      {/* Strategy Selection */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border-2 border-blue-600 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-blue-600 rounded-full" />
            <h3 className="text-slate-900">Strategy A</h3>
          </div>
          <select 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 mb-4"
            value={strategyAId}
            onChange={(e) => setStrategyAId(e.target.value)}
          >
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id} - {run.timestamp}
              </option>
            ))}
          </select>
          
          {/* Collapsable Parameters */}
          <button
            onClick={() => setShowStrategyAParams(!showStrategyAParams)}
            className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 rounded-md text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span>Strategy Parameters</span>
            {showStrategyAParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showStrategyAParams && (
            <div className="mt-3 space-y-4 text-slate-600 border-t border-slate-200 pt-3">
              <div className="text-slate-700 font-medium">Population & Horizon</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Agents:</span>
                  <span className="text-slate-900">{strategyA.config.N.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Steps:</span>
                  <span className="text-slate-900">{strategyA.config.steps} weeks</span>
                </div>
                <div className="flex justify-between">
                  <span>C target / kappa:</span>
                  <span className="text-slate-900">{strategyA.config.C_target.toFixed(3)} / {strategyA.config.kappa}</span>
                </div>
              </div>

              <div className="text-slate-700 font-medium">Calendar</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Deadline week:</span>
                  <span className="text-slate-900">{strategyA.config.tax_deadline_week}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit delay:</span>
                  <span className="text-slate-900">{strategyA.config.audit_delay_weeks} weeks</span>
                </div>
                <div className="flex justify-between">
                  <span>Warning visit:</span>
                  <span className="text-slate-900">week {strategyA.config.warning_visit_week}</span>
                </div>
              </div>

              <div className="text-slate-700 font-medium">Audit Types</div>
              <div className="space-y-2">
                {Object.entries(strategyA.config.audit_types).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="text-slate-900">effect {value.effect.toFixed(2)} · €{value.cost.toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div className="text-slate-700 font-medium">Channels</div>
              <div className="space-y-2">
                {Object.entries(strategyA.config.channel_effects).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="text-slate-900">effect {value.toFixed(3)} · €{strategyA.config.intervention_costs[key as keyof typeof strategyA.config.intervention_costs].toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="text-slate-700 font-medium">Decay</div>
              <div className="flex justify-between">
                <span>Weekly decay:</span>
                <span className="text-slate-900">{strategyA.config.decay_factor.toFixed(5)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border-2 border-orange-600 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-orange-600 rounded-full" />
            <h3 className="text-slate-900">Strategy B</h3>
          </div>
          <select 
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 mb-4"
            value={strategyBId}
            onChange={(e) => setStrategyBId(e.target.value)}
          >
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id} - {run.timestamp}
              </option>
            ))}
          </select>
          
          {/* Collapsable Parameters */}
          <button
            onClick={() => setShowStrategyBParams(!showStrategyBParams)}
            className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 rounded-md text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span>Strategy Parameters</span>
            {showStrategyBParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showStrategyBParams && (
            <div className="mt-3 space-y-4 text-slate-600 border-t border-slate-200 pt-3">
              <div className="text-slate-700 font-medium">Population & Horizon</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Agents:</span>
                  <span className="text-slate-900">{strategyB.config.N.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Steps:</span>
                  <span className="text-slate-900">{strategyB.config.steps} weeks</span>
                </div>
                <div className="flex justify-between">
                  <span>C target / kappa:</span>
                  <span className="text-slate-900">{strategyB.config.C_target.toFixed(3)} / {strategyB.config.kappa}</span>
                </div>
              </div>

              <div className="text-slate-700 font-medium">Calendar</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Deadline week:</span>
                  <span className="text-slate-900">{strategyB.config.tax_deadline_week}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit delay:</span>
                  <span className="text-slate-900">{strategyB.config.audit_delay_weeks} weeks</span>
                </div>
                <div className="flex justify-between">
                  <span>Warning visit:</span>
                  <span className="text-slate-900">week {strategyB.config.warning_visit_week}</span>
                </div>
              </div>

              <div className="text-slate-700 font-medium">Audit Types</div>
              <div className="space-y-2">
                {Object.entries(strategyB.config.audit_types).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="text-slate-900">effect {value.effect.toFixed(2)} · €{value.cost.toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div className="text-slate-700 font-medium">Channels</div>
              <div className="space-y-2">
                {Object.entries(strategyB.config.channel_effects).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <span className="text-slate-900">effect {value.toFixed(3)} · €{strategyB.config.intervention_costs[key as keyof typeof strategyB.config.intervention_costs].toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="text-slate-700 font-medium">Decay</div>
              <div className="flex justify-between">
                <span>Weekly decay:</span>
                <span className="text-slate-900">{strategyB.config.decay_factor.toFixed(5)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Comparison */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-slate-900 text-base font-medium mb-2">Final Compliance</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-blue-600">{(strategyA.summary.finalMean * 100).toFixed(1)}%</span>
            <span className="text-slate-400">vs</span>
            <span className="text-orange-600">{(strategyB.summary.finalMean * 100).toFixed(1)}%</span>
          </div>
          <div className={`${complianceDiff > 0 ? 'text-blue-600' : complianceDiff < 0 ? 'text-orange-600' : 'text-slate-500'}`}>
            {complianceDiff > 0 
              ? `Strategy A +${complianceDiff.toFixed(1)}% higher` 
              : complianceDiff < 0 
              ? `Strategy B +${Math.abs(complianceDiff).toFixed(1)}% higher`
              : 'Equal performance'}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-slate-900 text-base font-medium mb-2">Delta Mean</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-blue-600">{strategyA.summary.deltaMean.toFixed(3)}</span>
            <span className="text-slate-400">vs</span>
            <span className="text-orange-600">{strategyB.summary.deltaMean.toFixed(3)}</span>
          </div>
          <div className={`${strategyA.summary.deltaMean > strategyB.summary.deltaMean ? 'text-blue-600' : strategyA.summary.deltaMean < strategyB.summary.deltaMean ? 'text-orange-600' : 'text-slate-500'}`}>
            {strategyA.summary.deltaMean > strategyB.summary.deltaMean
              ? "Strategy A improves more"
              : strategyA.summary.deltaMean < strategyB.summary.deltaMean
              ? "Strategy B improves more"
              : "Equal improvement"}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-slate-900 text-base font-medium mb-2">Tax Gap Reduction</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-blue-600">{formatCurrency(strategyA.summary.taxGapReduction)}</span>
            <span className="text-slate-400">vs</span>
            <span className="text-orange-600">{formatCurrency(strategyB.summary.taxGapReduction)}</span>
          </div>
          <div className={`${gapDiff > 0 ? 'text-blue-600' : gapDiff < 0 ? 'text-orange-600' : 'text-slate-500'}`}>
            {gapDiff > 0 
              ? "Strategy A reduces more" 
              : gapDiff < 0
              ? "Strategy B reduces more"
              : "Equal reduction"}
          </div>
        </div>
      </div>

      {/* Outcome Charts */}
      <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
        <h3 className="text-slate-900 text-md font-medium mb-4">Outcome Comparison</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={complianceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="strategyA" fill="#3b82f6" name="Strategy A" />
            <Bar dataKey="strategyB" fill="#f97316" name="Strategy B" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-6">
          <h4 className="text-slate-700 font-medium mb-3">Financial Impact</h4>
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
            {financialData.map((row) => (
              <div key={row.metric} className="bg-slate-50 border border-slate-200 rounded-md p-3">
                <div className="text-slate-500">{row.metric}</div>
                <div className="text-slate-900 mt-1">
                  A: {row.metric === "ROI Ratio" ? row.strategyA.toFixed(2) : formatCurrency(row.strategyA)}
                  {" · "}
                  B: {row.metric === "ROI Ratio" ? row.strategyB.toFixed(2) : formatCurrency(row.strategyB)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="grid grid-cols-2 gap-6">
        <div className={`${strategyA.summary.finalMean > strategyB.summary.finalMean ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-6`}>
          <h3 className={`${strategyA.summary.finalMean > strategyB.summary.finalMean ? 'text-blue-900' : 'text-orange-900'} mb-4`}>
            Best for Compliance
          </h3>
          <p className={`${strategyA.summary.finalMean > strategyB.summary.finalMean ? 'text-blue-900' : 'text-orange-900'} mb-2`}>
            {strategyA.summary.finalMean > strategyB.summary.finalMean 
              ? `Strategy A: ${strategyA.id}`
              : `Strategy B: ${strategyB.id}`}
          </p>
          <p className={`${strategyA.summary.finalMean > strategyB.summary.finalMean ? 'text-blue-800' : 'text-orange-800'}`}>
            {strategyA.summary.finalMean > strategyB.summary.finalMean 
              ? `Delivers higher final compliance (${(strategyA.summary.finalMean * 100).toFixed(1)}% vs ${(strategyB.summary.finalMean * 100).toFixed(1)}%).`
              : `Delivers higher final compliance (${(strategyB.summary.finalMean * 100).toFixed(1)}% vs ${(strategyA.summary.finalMean * 100).toFixed(1)}%).`}
          </p>
        </div>

        <div className={`${strategyA.summary.netBenefit > strategyB.summary.netBenefit ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-6`}>
          <h3 className={`${strategyA.summary.netBenefit > strategyB.summary.netBenefit ? 'text-blue-900' : 'text-orange-900'} mb-4`}>
            Best for Net Benefit
          </h3>
          <p className={`${strategyA.summary.netBenefit > strategyB.summary.netBenefit ? 'text-blue-900' : 'text-orange-900'} mb-2`}>
            {strategyA.summary.netBenefit > strategyB.summary.netBenefit 
              ? `Strategy A: ${strategyA.id}`
              : `Strategy B: ${strategyB.id}`}
          </p>
          <p className={`${strategyA.summary.netBenefit > strategyB.summary.netBenefit ? 'text-blue-800' : 'text-orange-800'}`}>
            {strategyA.summary.netBenefit > strategyB.summary.netBenefit 
              ? `Net benefit ${formatCurrency(strategyA.summary.netBenefit)} vs ${formatCurrency(strategyB.summary.netBenefit)}.`
              : `Net benefit ${formatCurrency(strategyB.summary.netBenefit)} vs ${formatCurrency(strategyA.summary.netBenefit)}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
