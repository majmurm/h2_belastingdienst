import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { PopulationPanel } from './components/PopulationPanel';
import { StrategyPanel } from './components/StrategyPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { ComparisonPanel } from './components/ComparisonPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { InformationPanel } from './components/InformationPanel';
import { defaultModelConfig } from './data/modelDefaults';
import { runModel } from './data/modelApi';
import type { ModelConfig, ModelResults } from './data/modelTypes';
import type { RunRecord } from './data/runHistory';

export default function App() {
  const [activeView, setActiveView] = useState<'population' | 'strategy' | 'results' | 'compare' | 'history' | 'information'>('population');
  const [currentStep, setCurrentStep] = useState(1);
  const [comparisonRunIds, setComparisonRunIds] = useState<[string, string]>(['current', 'current']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(defaultModelConfig);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runtimeMs, setRuntimeMs] = useState<number | null>(null);
  const [estimatedRuntimeMs, setEstimatedRuntimeMs] = useState<number | null>(null);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [autoExport, setAutoExport] = useState(false);
  const [runHistory, setRunHistory] = useState<RunRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem('sme-model-history');
      if (!stored) return [];
      const parsed = JSON.parse(stored) as RunRecord[];
      return parsed.map((run) => ({
        ...run,
        summary: {
          ...run.summary,
          totalCost: run.summary.totalCost ?? 0,
          netBenefit: run.summary.netBenefit ?? 0,
          roiRatio: run.summary.roiRatio ?? 0,
        },
      }));
    } catch {
      return [];
    }
  });

  const latestRunIds = useMemo<[string, string]>(() => {
    const ids = runHistory.slice(0, 2).map((run) => run.id);
    if (ids.length === 2) return [ids[0], ids[1]];
    if (ids.length === 1) return [ids[0], ids[0]];
    return ['current', 'current'];
  }, [runHistory]);

  const scrollToTop = () => {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      setActiveView('strategy');
      setCurrentStep(2);
      scrollToTop();
    }
  };

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setRunError(null);
    setEstimatedRuntimeMs(runtimeMs);
    const startTime = performance.now();

    try {
      const results = await runModel(modelConfig);
      setModelResults(results);
      setRuntimeMs(performance.now() - startTime);
      const initialMean = results.initial.overall_mean;
      const finalMean = results.final.overall_mean;
      const deltaMean = finalMean - initialMean;
      const initialGap = results.initial.tax_gap.total_gap;
      const finalGap = results.final.tax_gap.total_gap;
      const taxGapReduction = initialGap - finalGap;
      const taxGapReductionPct = initialGap > 0 ? (taxGapReduction / initialGap) * 100 : 0;

      const timestamp = new Date();
      const timestampStr = formatAmsterdamTimestamp(timestamp);
      const runId = `RUN-${timestampStr.replace(/[-: ]/g, '')}`;
      const summary = results.summary ?? {
        tax_gap_reduction: taxGapReduction,
        total_cost: 0,
        net_benefit: taxGapReduction,
        roi_ratio: 0,
      };

      const runRecord: RunRecord = {
        id: runId,
        timestamp: timestampStr,
        config: results.config,
        results,
        summary: {
          initialMean,
          finalMean,
          deltaMean,
          taxGapReduction,
          taxGapReductionPct,
          totalCost: summary.total_cost,
          netBenefit: summary.net_benefit,
          roiRatio: summary.roi_ratio,
        },
      };
      setLatestRunId(runId);
      setRunHistory((prev) => [runRecord, ...prev]);
      setActiveView('results');
      setCurrentStep(3);
      scrollToTop();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run model.';
      setRunError(message);
      setRuntimeMs(null);
      setActiveView('results');
      setCurrentStep(3);
      scrollToTop();
    } finally {
      setIsRunning(false);
    }
  };

  const handleCompareRuns = (runIds: [string, string]) => {
    setComparisonRunIds(runIds);
    setActiveView('compare');
    scrollToTop();
  };

  const handleViewRun = (runId: string) => {
    const run = runHistory.find((item) => item.id === runId);
    if (!run) return;
    setModelResults(run.results);
    setModelConfig(run.config);
    setLatestRunId(run.id);
    setRuntimeMs(null);
    setActiveView('results');
    setCurrentStep(3);
    scrollToTop();
  };

  const handleDownloadRun = (runId: string) => {
    const run = runHistory.find((item) => item.id === runId);
    if (!run) return;
    setModelResults(run.results);
    setModelConfig(run.config);
    setLatestRunId(run.id);
    setRuntimeMs(null);
    setAutoExport(true);
    setActiveView('results');
    setCurrentStep(3);
    scrollToTop();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('sme-model-history', JSON.stringify(runHistory));
    } catch {
      // Ignore storage errors.
    }
  }, [runHistory]);

  const renderPanel = () => {
    switch (activeView) {
      case 'population':
        return (
          <PopulationPanel
            config={modelConfig}
            onConfigChange={setModelConfig}
            onNext={handleNextStep}
          />
        );
      case 'strategy':
        return (
          <StrategyPanel
            config={modelConfig}
            onConfigChange={setModelConfig}
            onRun={handleRunSimulation}
            isRunning={isRunning}
            estimatedRuntimeMs={estimatedRuntimeMs}
          />
        );
      case 'results':
        return (
          <ResultsPanel
            results={modelResults}
            config={modelResults?.config ?? modelConfig}
            isRunning={isRunning}
            runError={runError}
            runtimeMs={runtimeMs}
            runId={latestRunId}
            autoExport={autoExport}
            onExportComplete={() => setAutoExport(false)}
          />
        );
      case 'compare':
        return (
          <ComparisonPanel
            runs={runHistory}
            initialRunIds={comparisonRunIds[0] === 'current' ? latestRunIds : comparisonRunIds}
          />
        );
      case 'history':
        return (
          <HistoryPanel
            runs={runHistory}
            onCompareRuns={handleCompareRuns}
            onViewRun={handleViewRun}
            onDownloadRun={handleDownloadRun}
          />
        );
      case 'information':
        return <InformationPanel />;
      default:
        return (
          <PopulationPanel
            config={modelConfig}
            onConfigChange={setModelConfig}
            onNext={handleNextStep}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <Sidebar 
        activeView={activeView} 
        onViewChange={(view) => {
          setActiveView(view);
          if (view === 'population') setCurrentStep(1);
          else if (view === 'strategy') setCurrentStep(2);
          else if (view === 'results') setCurrentStep(3);
          scrollToTop();
        }} 
        currentStep={currentStep}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto bg-slate-50 relative" style={{ zIndex: 100 }}>
        {renderPanel()}
      </main>
    </div>
  );
}
  const formatAmsterdamTimestamp = (date: Date) =>
    date
      .toLocaleString('sv-SE', {
        timeZone: 'Europe/Amsterdam',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      .replace(' ', ' ');
