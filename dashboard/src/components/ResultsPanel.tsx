import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Clock, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ModelConfig, ModelResults, GroupKey } from "../data/modelTypes";

interface ResultsPanelProps {
  results: ModelResults | null;
  config: ModelConfig;
  isRunning: boolean;
  runError: string | null;
  runtimeMs: number | null;
  runId: string | null;
  autoExport?: boolean;
  onExportComplete?: () => void;
}

const groupOptions: { key: GroupKey | "overall"; label: string; color: string }[] = [
  { key: "overall", label: "Global Mean", color: "#0f172a" },
  { key: "Micro-Young", label: "Micro & Young", color: "#06b6d4" },
  { key: "Micro-Mature", label: "Micro & Mature", color: "#0ea5e9" },
  { key: "Micro-Old", label: "Micro & Old", color: "#3b82f6" },
  { key: "Small-Young", label: "Small & Young", color: "#ec4899" },
  { key: "Small-Mature", label: "Small & Mature", color: "#d946ef" },
  { key: "Small-Old", label: "Small & Old", color: "#f59e0b" },
  { key: "Medium-Young", label: "Medium & Young", color: "#8b5cf6" },
  { key: "Medium-Mature", label: "Medium & Mature", color: "#6366f1" },
  { key: "Medium-Old", label: "Medium & Old", color: "#10b981" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    value,
  );

export function ResultsPanel({
  results,
  config,
  isRunning,
  runError,
  runtimeMs,
  runId,
  autoExport = false,
  onExportComplete,
}: ResultsPanelProps) {
  const [selectedGroups, setSelectedGroups] = useState<(GroupKey | "overall")[]>(
    groupOptions.map((option) => option.key),
  );
  const [isExporting, setIsExporting] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const handleExportPdf = () => {
    const target = resultsRef.current;
    if (!target || isExporting) {
      if (!target) {
        // eslint-disable-next-line no-alert
        alert("Export failed: results section not found.");
      }
      return;
    }
    if (!results) {
      // eslint-disable-next-line no-alert
      alert("Export failed: run the model to generate results first.");
      return;
    }

    setIsExporting(true);
    document.body.classList.add("export-results-only");

    Promise.all([import("html2canvas"), import("jspdf")])
      .then(async ([html2canvasModule, jsPDFModule]) => {
        const html2canvas = html2canvasModule.default ?? html2canvasModule;
        const jsPDFConstructor = jsPDFModule.jsPDF ?? jsPDFModule.default;
        if (!jsPDFConstructor) {
          throw new Error("PDF library not available.");
        }

        const exportWrapper = document.createElement("div");
        exportWrapper.className = "print-results export-canvas";
        exportWrapper.style.position = "fixed";
        exportWrapper.style.left = "0";
        exportWrapper.style.top = "0";
        exportWrapper.style.width = "100%";
        exportWrapper.style.background = "#ffffff";
        exportWrapper.style.display = "flex";
        exportWrapper.style.justifyContent = "center";
        exportWrapper.style.padding = "24px";

        const clone = target.cloneNode(true) as HTMLElement;
        clone.style.width = "72rem";
        clone.style.maxWidth = "100%";
        clone.style.margin = "0";
        clone.style.padding = "0";

        exportWrapper.appendChild(clone);
        document.body.appendChild(exportWrapper);

        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const svgElements = exportWrapper.querySelectorAll("svg");
        svgElements.forEach((svg) => {
          const rect = svg.getBoundingClientRect();
          const serialized = new XMLSerializer().serializeToString(svg);
          const encoded = encodeURIComponent(serialized);
          const img = document.createElement("img");
          img.src = `data:image/svg+xml;charset=utf-8,${encoded}`;
          img.width = Math.round(rect.width);
          img.height = Math.round(rect.height);
          img.style.width = `${rect.width}px`;
          img.style.height = `${rect.height}px`;
          img.style.display = "block";
          svg.replaceWith(img);
        });

        const canvas = await html2canvas(exportWrapper, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          foreignObjectRendering: true,
          windowWidth: exportWrapper.scrollWidth,
          windowHeight: exportWrapper.scrollHeight,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            const style = clonedDoc.createElement("style");
            style.textContent = `
              * {
                color: rgb(15, 23, 42) !important;
                background-color: rgb(255, 255, 255) !important;
                border-color: rgb(226, 232, 240) !important;
                outline-color: rgb(148, 163, 184) !important;
              }
              svg, svg * {
                color: inherit !important;
              }
            `;
            clonedDoc.head.appendChild(style);
          },
        });

        exportWrapper.remove();

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDFConstructor({
          orientation: "p",
          unit: "pt",
          format: "a4",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${runId ?? "results"}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("PDF export failed", error);
        // eslint-disable-next-line no-alert
        alert("Export failed. Check the console for details.");
      })
      .finally(() => {
        document.body.classList.remove("export-results-only");
        setIsExporting(false);
        onExportComplete?.();
      });
  };

  useEffect(() => {
    if (autoExport && !isExporting && results) {
      handleExportPdf();
    }
  }, [autoExport, isExporting, results]);

  const timelineData = useMemo(() => {
    if (!results) return [];
    return results.steps.map((step) => ({
      step: step.step,
      label: `W${step.step}`,
      overall: step.overall_mean,
      auditPercentage: step.overall_audited_pct / 100,
      ...step.mean_by_group,
    }));
  }, [results]);

  const currentStep = results?.steps[results.steps.length - 1];
  const initialStep = results?.steps[0];

  const groupTaxGap = currentStep?.tax_gap.by_group ?? {};
  const selectedSet = new Set(selectedGroups);

  const selectedConfig = results?.config ?? config;

  return (
    <div ref={resultsRef} className="p-12 max-w-6xl print-results">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600 px-2.5 py-1 bg-blue-50 rounded">
                Step 3
              </span>
              <h2 className="text-slate-900">Results</h2>
            </div>
            <p className="text-slate-600">
              Model outputs for the configured population and strategy.
            </p>
          </div>
          <div className="flex items-center gap-3 print-hide">
            <Clock className="w-4 h-4" />
            <span>
              {isRunning
                ? "Running..."
                : runtimeMs !== null
                ? `Runtime: ${(runtimeMs / 1000).toFixed(2)}s`
                : "Runtime: —"}
            </span>
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>
        </div>
      </div>

      {runError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {runError}
        </div>
      )}

      {!results && !isRunning && !runError && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-slate-600">
          Run the simulation to see results.
        </div>
      )}

      {results && (
        <>
          <div className="mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-slate-900 text-md font-medium mb-4">
                Target Population Characteristics
              </h3>
              <div className="grid gap-x-8 gap-y-1.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="flex justify-between">
                  <span className="text-slate-500">Agents (N):</span>
                  <span className="text-slate-900">{selectedConfig.N.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Steps:</span>
                  <span className="text-slate-900">{selectedConfig.steps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Size Shares:</span>
                  <span className="text-slate-900">
                    Micro {(selectedConfig.size_shares.Micro * 100).toFixed(1)}% /
                    Small {(selectedConfig.size_shares.Small * 100).toFixed(1)}% /
                    Medium {(selectedConfig.size_shares.Medium * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Age Shares:</span>
                  <span className="text-slate-900">
                    Young {(selectedConfig.age_shares.Young * 100).toFixed(1)}% /
                    Mature {(selectedConfig.age_shares.Mature * 100).toFixed(1)}% /
                    Old {(selectedConfig.age_shares.Old * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Mean (C_target):</span>
                  <span className="text-slate-900">{selectedConfig.C_target.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dispersion (kappa):</span>
                  <span className="text-slate-900">{selectedConfig.kappa}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-slate-900 text-md font-medium mb-4">
                Sector Coverage & Compliance
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedConfig.selected_sectors.map((sector) => (
                  <div key={sector} className="flex justify-between gap-4">
                    <span className="text-slate-600">{sector}</span>
                    <span className="text-slate-900">
                      {currentStep?.mean_by_sector?.[sector]?.toFixed(3) ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-slate-900 text-md font-medium mb-4">Key Performance Indicators</h3>
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">Overall Mean Propensity</h3>
                <div className="text-slate-900 mb-1">{currentStep?.overall_mean.toFixed(3)}</div>
                <p className="text-slate-500">Current step value</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">Delta from Step 0</h3>
                <div
                  className={`mb-1 ${
                    (currentStep?.overall_mean ?? 0) - (initialStep?.overall_mean ?? 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {((currentStep?.overall_mean ?? 0) - (initialStep?.overall_mean ?? 0)).toFixed(3)}
                </div>
                <p className="text-slate-500">Change since baseline</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">High Compliance</h3>
                <div className="text-slate-900 mb-1">{currentStep?.high_compliance_pct.toFixed(1)}%</div>
                <p className="text-slate-500">Propensity ≥ 0.8</p>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">% Audited This Step</h3>
                <div className="text-slate-900 mb-1">{currentStep?.overall_audited_pct.toFixed(2)}%</div>
                <p className="text-slate-500">Overall population</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-slate-900 text-md font-medium mb-4">Impact & ROI</h3>
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">Tax Gap Reduction</h3>
                <div className="text-slate-900 mb-1">
                  {results.summary ? formatCurrency(results.summary.tax_gap_reduction) : "—"}
                </div>
                <p className="text-slate-500">Final vs baseline</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">Total Cost</h3>
                <div className="text-slate-900 mb-1">
                  {results.summary ? formatCurrency(results.summary.total_cost) : "—"}
                </div>
                <p className="text-slate-500">All interventions</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">Net Benefit</h3>
                <div className="text-slate-900 mb-1">
                  {results.summary ? formatCurrency(results.summary.net_benefit) : "—"}
                </div>
                <p className="text-slate-500">Reduction minus cost</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-slate-600 mb-2">ROI Ratio</h3>
                <div className="text-slate-900 mb-1">
                  {results.summary ? results.summary.roi_ratio.toFixed(2) : "—"}
                </div>
                <p className="text-slate-500">Return per €1 spent</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-slate-900 text-md font-medium mb-4">
                Annual Tax Gap by Group (Current Step)
              </h3>
              <p className="text-slate-600 mb-4">
                Estimated annual revenue loss from non-compliance per enterprise group.
              </p>
              <div className="grid grid-cols-3 gap-6">
                {["Micro", "Small", "Medium"].map((size) => (
                  <div key={size} className="space-y-2">
                    <h4 className="text-slate-700 font-medium text-sm mb-3">{size}</h4>
                    {["Young", "Mature", "Old"].map((age) => {
                      const key = `${size}-${age}` as GroupKey;
                      const entry = groupTaxGap[key];
                      return (
                        <div key={key} className="flex justify-between items-center p-2.5 bg-slate-50 rounded">
                          <span className="text-slate-600 text-sm">{age}</span>
                          <span className="text-slate-900 text-sm font-medium">
                            {entry ? formatCurrency(entry.gap) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-slate-900 text-md font-medium mb-2">
                    SME Tax Compliance: 5-Year Simulation
                  </h3>
                  <p className="text-slate-600">
                    Strategy: Pulsed Audits + Behavioral Nudges
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mb-4">
                {groupOptions.map((option) => (
                  <label key={option.key} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(option.key)}
                      onChange={() => {
                        const next = new Set(selectedSet);
                        if (next.has(option.key)) {
                          next.delete(option.key);
                        } else {
                          next.add(option.key);
                        }
                        setSelectedGroups(Array.from(next));
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={480}>
                <ComposedChart
                  data={timelineData}
                  margin={{
                    top: 10,
                    right: 160,
                    left: 10,
                    bottom: 20,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={5}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    domain={[0.6, 0.9]}
                    label={{ value: "Mean Compliance Propensity", angle: -90, position: "insideLeft" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    domain={[0, 0.15]}
                    label={{ value: "% Population Audited", angle: 90, position: "insideRight" }}
                  />
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: "12px" }}
                  />
                  {groupOptions
                    .filter((option) => option.key !== "overall")
                    .map((option) =>
                      selectedSet.has(option.key) ? (
                        <Line
                          key={option.key}
                          yAxisId="left"
                          type="monotone"
                          dataKey={option.key}
                          stroke={option.color}
                          strokeWidth={1.5}
                          name={option.label}
                          dot={false}
                          opacity={0.85}
                        />
                      ) : null,
                    )}
                  {selectedSet.has("overall") && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="overall"
                      stroke="#000000"
                      strokeWidth={2.5}
                      name="Global Mean"
                      dot={false}
                      strokeDasharray="3 3"
                    />
                  )}
                  <Area
                    yAxisId="right"
                    type="stepAfter"
                    dataKey="auditPercentage"
                    stroke="#ef4444"
                    fill="#fecaca"
                    name="% Audited"
                    fillOpacity={0.4}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-slate-900 text-md font-medium mb-4">
                Audit Coverage (Current Step)
              </h3>
              <div className="text-slate-600">
                Audits are concentrated during the annual campaign week. The overall audited share for this step is{" "}
                <span className="text-slate-900 font-medium">{currentStep?.overall_audited_pct.toFixed(2)}%</span>.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
