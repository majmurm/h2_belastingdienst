import { useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { PopulationPanel } from './components/PopulationPanel';
import { StrategyPanel } from './components/StrategyPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { ComparisonPanel } from './components/ComparisonPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { InformationPanel } from './components/InformationPanel';
import { defaultModelConfig } from './data/modelDefaults';
import { fetchModelProgress, runModel } from './data/modelApi';
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
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [autoExport, setAutoExport] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem('sme-model-history');
      if (!stored) return [];
      const parsed = JSON.parse(stored) as RunRecord[];
      return parsed.map((run) => ({
        ...run,
        displayName: run.displayName ?? run.id,
        summary: {
          ...run.summary,
          totalCost: run.summary.totalCost ?? 0,
          netBenefit: run.summary.netBenefit ?? 0,
          roiRatio: run.summary.roiRatio ?? 0,
        },
        results: run.results,
        config: {
          ...defaultModelConfig,
          ...run.config,
          sector_shares: run.config.sector_shares ?? defaultModelConfig.sector_shares,
          selected_sectors: run.config.selected_sectors ?? defaultModelConfig.selected_sectors,
        },
      }));
    } catch {
      return [];
    }
  });

  const compressResultsForHistory = (results: ModelResults): ModelResults => {
    const steps = results.steps ?? [];
    const maxSteps = 60;
    if (steps.length <= maxSteps) {
      return results;
    }

    const indices = new Set<number>([0, steps.length - 1]);
    const stride = Math.max(1, Math.floor(steps.length / (maxSteps - 1)));
    for (let i = stride; i < steps.length - 1; i += stride) {
      indices.add(i);
    }
    const ordered = Array.from(indices).sort((a, b) => a - b);
    const reducedSteps = ordered.map((idx) => steps[idx]);

    return {
      ...results,
      steps: reducedSteps,
      final: results.final,
    };
  };

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
    setProgress({ current: 0, total: 0 });
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const startTime = performance.now();

    try {
      const results = await runModel(modelConfig, { signal: abortController.signal });
      setModelResults(results);
      const elapsedMs = performance.now() - startTime;
      setRuntimeMs(elapsedMs);
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

      const resultsForHistory = compressResultsForHistory(results);

      const runRecord: RunRecord = {
        id: runId,
        displayName: runId,
        timestamp: timestampStr,
        config: modelConfig,
        results: resultsForHistory,
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
        runtimeMs: elapsedMs,
      };
      setLatestRunId(runId);
      setRunHistory((prev) => [runRecord, ...prev].slice(0, 20));
      setActiveView('results');
      setCurrentStep(3);
      scrollToTop();
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      const message = isAbort
        ? 'Model run interrupted.'
        : error instanceof Error
        ? error.message
        : 'Failed to run model.';
      setRunError(message);
      setRuntimeMs(null);
      setActiveView('results');
      setCurrentStep(3);
      scrollToTop();
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  };

  const handleInterruptRun = () => {
    abortControllerRef.current?.abort();
  };

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const payload = await fetchModelProgress();
        if (!cancelled) {
          setProgress({ current: payload.current_step, total: payload.total_steps });
        }
      } catch {
        if (!cancelled) {
          setProgress((prev) => prev);
        }
      }
    };
    poll();
    const interval = window.setInterval(poll, 500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isRunning]);

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

  const handleRenameRun = (runId: string, displayName: string) => {
    if (runId === "__clear__") {
      setRunHistory([]);
      return;
    }
    setRunHistory((prev) =>
      prev.map((run) => (run.id === runId ? { ...run, displayName } : run)),
    );
  };

  const handleDeleteRun = (runId: string) => {
    setRunHistory((prev) => prev.filter((run) => run.id !== runId));
    setComparisonRunIds((prev) => {
      if (prev[0] === runId || prev[1] === runId) {
        return ['current', 'current'];
      }
      return prev;
    });
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
            onInterrupt={handleInterruptRun}
            isRunning={isRunning}
            progress={progress}
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
            onRenameRun={handleRenameRun}
            onDeleteRun={handleDeleteRun}
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
