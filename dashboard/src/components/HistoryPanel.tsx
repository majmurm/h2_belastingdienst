import { useState } from 'react';
import { Download, Eye, Info, GitCompare } from 'lucide-react';
import { Tooltip } from './Tooltip';
import type { RunRecord } from '../data/runHistory';

interface HistoryPanelProps {
  runs: RunRecord[];
  onCompareRuns?: (runIds: [string, string]) => void;
  onViewRun?: (runId: string) => void;
  onDownloadRun?: (runId: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    value,
  );

export function HistoryPanel({ runs, onCompareRuns, onViewRun, onDownloadRun }: HistoryPanelProps) {
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  const viewDetails = (run: RunRecord) => {
    setSelectedRun(run);
    setViewMode('details');
  };

  const exportAllRuns = () => {
    const exportData = runs.map(run => ({
      runId: run.id,
      timestamp: run.timestamp,
      parameters: {
        config: run.config,
      },
      results: run.results,
      summary: run.summary,
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_runs_export.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleComparisonSelection = (runId: string) => {
    if (selectedForComparison.includes(runId)) {
      setSelectedForComparison(selectedForComparison.filter(id => id !== runId));
    } else {
      if (selectedForComparison.length < 2) {
        setSelectedForComparison([...selectedForComparison, runId]);
      }
    }
  };

  const handleCompare = () => {
    if (selectedForComparison.length === 2 && onCompareRuns) {
      onCompareRuns([selectedForComparison[0], selectedForComparison[1]] as [string, string]);
    }
  };

  return (
    <div className="p-12 max-w-6xl">
      <div className="mb-1">
        <h2 className="text-slate-900 mb-2">Run History</h2>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <p className="text-slate-600">
          {viewMode === 'table' && selectedForComparison.length > 0 
            ? `${selectedForComparison.length} run(s) selected for comparison. Select ${2 - selectedForComparison.length} more to compare.`
            : 'View and export previous simulation runs'}
        </p>
        <div className="flex gap-3">
          {viewMode === 'details' && (
            <button
              onClick={() => setViewMode('table')}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
            >
              Back to List
            </button>
          )}
          {viewMode === 'table' && selectedForComparison.length === 2 && (
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <GitCompare className="w-4 h-4" />
              Compare Selected ({selectedForComparison.length})
            </button>
          )}
          <button
            onClick={exportAllRuns}
            className="px-4 py-2 bg-[#0C3358] text-white rounded-md hover:bg-[#0f4170] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {runs.length === 0 ? (
            <div className="p-6 text-slate-600">No model runs yet. Run a simulation to populate history.</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-700 w-20">
                    <div className="flex items-center gap-1">
                      Compare
                      <Tooltip content="Select up to 2 runs to compare">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                      </Tooltip>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-slate-700 w-16">ID</th>
                  <th className="px-4 py-3 text-left text-slate-700">Timestamp</th>
                  <th className="px-4 py-3 text-left text-slate-700 w-28">
                    <div className="flex items-center gap-1">
                      Delta
                      <Tooltip content="Change in overall mean compliance from step 0">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                      </Tooltip>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-slate-700 w-32">
                    <div className="flex items-center gap-1">
                      Tax Gap
                      <Tooltip content="Total tax gap reduction vs. step 0">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                      </Tooltip>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-slate-700 w-32">Final Compliance</th>
                  <th className="px-4 py-3 text-left text-slate-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedForComparison.includes(run.id)}
                        onChange={() => toggleComparisonSelection(run.id)}
                        disabled={!selectedForComparison.includes(run.id) && selectedForComparison.length >= 2}
                        className="w-4 h-4 text-[#0C3358] rounded border-slate-300 focus:ring-[#0C3358] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-900">{run.id}</td>
                    <td className="px-4 py-3 text-slate-600">{run.timestamp}</td>
                    <td className="px-4 py-3 text-slate-900">{run.summary.deltaMean.toFixed(3)}</td>
                    <td className="px-4 py-3 text-slate-900">{formatCurrency(run.summary.taxGapReduction)}</td>
                    <td className="px-4 py-3 text-slate-900">{(run.summary.finalMean * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (onViewRun) {
                              onViewRun(run.id);
                            } else {
                              viewDetails(run);
                            }
                          }}
                          className="p-2 text-[#0C3358] hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDownloadRun?.(run.id)}
                          className="p-2 text-[#0C3358] hover:bg-blue-50 rounded transition-colors"
                          title="Export Run"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : selectedRun && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-slate-900 mb-1">{selectedRun.id}</h2>
                <p className="text-slate-600">Run Date: {selectedRun.timestamp}</p>
              </div>
              <button
                onClick={() => onDownloadRun?.(selectedRun.id)}
                className="px-4 py-2 bg-[#0C3358] text-white rounded-md hover:bg-[#0f4170] transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Population Parameters */}
              <div>
                <h3 className="text-slate-900 text-base font-medium mb-4 pb-2 border-b border-slate-200">Population Parameters</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Agents (N):</span>
                    <span className="text-slate-900">{selectedRun.config.N.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Size Shares:</span>
                    <span className="text-slate-900">
                      Micro {(selectedRun.config.size_shares.Micro * 100).toFixed(1)}% /
                      Small {(selectedRun.config.size_shares.Small * 100).toFixed(1)}% /
                      Medium {(selectedRun.config.size_shares.Medium * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Age Shares:</span>
                    <span className="text-slate-900">
                      Young {(selectedRun.config.age_shares.Young * 100).toFixed(1)}% /
                      Mature {(selectedRun.config.age_shares.Mature * 100).toFixed(1)}% /
                      Old {(selectedRun.config.age_shares.Old * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Target Mean (C_target):</span>
                    <span className="text-slate-900">{selectedRun.config.C_target.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Dispersion (kappa):</span>
                    <span className="text-slate-900">{selectedRun.config.kappa}</span>
                  </div>
                </div>
              </div>

              {/* Strategy Parameters */}
              <div>
                <h3 className="text-slate-900 text-base font-medium mb-4 pb-2 border-b border-slate-200">Strategy Parameters</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Audit Impact:</span>
                    <span className="text-slate-900">{selectedRun.config.auditing_param.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Communication Impact:</span>
                    <span className="text-slate-900">{selectedRun.config.commun_param.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Decay Factor:</span>
                    <span className="text-slate-900">{selectedRun.config.decay_factor.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Steps:</span>
                    <span className="text-slate-900">{selectedRun.config.steps}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="text-slate-900 text-base font-medium mb-4 pb-2 border-b border-slate-200">Results Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-slate-600 mb-1">Initial Mean</div>
                <div className="text-slate-900">{selectedRun.summary.initialMean.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-slate-600 mb-1">Final Mean</div>
                <div className="text-slate-900">{selectedRun.summary.finalMean.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-slate-600 mb-1">Delta</div>
                <div className="text-slate-900">{selectedRun.summary.deltaMean.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-slate-600 mb-1">Tax Gap Reduction</div>
                <div className="text-slate-900">{formatCurrency(selectedRun.summary.taxGapReduction)}</div>
              </div>
              <div>
                <div className="text-slate-600 mb-1">Total Cost</div>
                <div className="text-slate-900">{formatCurrency(selectedRun.summary.totalCost)}</div>
              </div>
              <div>
                <div className="text-slate-600 mb-1">Net Benefit</div>
                <div className="text-slate-900">{formatCurrency(selectedRun.summary.netBenefit)}</div>
              </div>
              <div>
                <div className="text-slate-600 mb-1">ROI Ratio</div>
                <div className="text-slate-900">{selectedRun.summary.roiRatio.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
