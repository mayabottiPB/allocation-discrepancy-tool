"use client";

import { useState, useCallback } from "react";
import { Layers, Sparkles, RotateCcw, AlertTriangle } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FeedbackInput } from "@/components/FeedbackInput";
import { ValidationModal } from "@/components/ValidationModal";
import { ResultCard } from "@/components/ResultCard";
import { aggregateResult, aggregateByStyleNumber } from "@/lib/parseSpreadsheet";
import type {
  AllocationRow,
  ParsedSpreadsheet,
  ExtractedMention,
  AnalysisResult,
  AnalyzeResponse,
  UserFeedback,
  RefineResponse,
} from "@/lib/types";

type AppState = "idle" | "analyzing" | "validating" | "done" | "error";

export default function Home() {
  // Spreadsheet state
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [uniqueStores, setUniqueStores] = useState<Array<{ storeNumber: string; storeName: string }>>([]);
  const [uniqueStyles, setUniqueStyles] = useState<string[]>([]);
  const [columnWarnings, setColumnWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Feedback state
  const [feedback, setFeedback] = useState("");

  // Analysis state
  const [appState, setAppState] = useState<AppState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validation queue
  const [pendingMentions, setPendingMentions] = useState<ExtractedMention[]>([]);
  const [resolvedMentions, setResolvedMentions] = useState<ExtractedMention[]>([]);

  // Results
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [refiningId, setRefiningId] = useState<string | null>(null);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleParsed = useCallback((parsed: ParsedSpreadsheet, name: string) => {
    setRows(parsed.rows);
    setUniqueStores(parsed.uniqueStores);
    setUniqueStyles(parsed.uniqueStyles);
    setColumnWarnings(parsed.columnWarnings);
    setFileName(name);
  }, []);

  const handleClear = useCallback(() => {
    setRows([]);
    setUniqueStores([]);
    setUniqueStyles([]);
    setColumnWarnings([]);
    setFileName(null);
  }, []);

  const reset = useCallback(() => {
    setAppState("idle");
    setErrorMsg(null);
    setPendingMentions([]);
    setResolvedMentions([]);
    setResults([]);
    setFeedback("");
    handleClear();
  }, [handleClear]);

  // Build results from resolved mentions
  const buildResults = useCallback(
    (mentions: ExtractedMention[]) => {
      const out: AnalysisResult[] = [];
      for (const m of mentions) {
        if (!m.matchedStoreNumber || !m.matchedStyle) continue;
        const agg = aggregateResult(rows, m.matchedStoreNumber, m.matchedStyle);
        out.push({
          id: m.id,
          storeNumber: m.matchedStoreNumber,
          storeName: m.matchedStoreName ?? agg.storeName,
          style: m.matchedStyle,
          skusIncluded: agg.skusIncluded,
          totalInbound: agg.totalInbound,
          netSalesUnits: agg.netSalesUnits,
          eopOHATPUnits: agg.eopOHATPUnits,
          status: agg.totalInbound > 0 ? "no-action" : agg.netSalesUnits > 0 ? "action-send-stock" : "action-challenge",
        });
      }
      setResults(out);
      setAppState("done");
    },
    [rows]
  );

  const handleAnalyze = useCallback(async () => {
    if (!rows.length || !feedback.trim()) return;

    setAppState("analyzing");
    setErrorMsg(null);
    setPendingMentions([]);
    setResolvedMentions([]);
    setResults([]);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, uniqueStores, uniqueStyles }),
      });
      const data: AnalyzeResponse = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
        setAppState("error");
        return;
      }
      if (!data.mentions.length) {
        setErrorMsg("No store or product references were found in the feedback.");
        setAppState("error");
        return;
      }

      const needValidation = data.mentions.filter((m) => m.needsValidation);
      const autoResolved = data.mentions.filter((m) => !m.needsValidation);

      if (needValidation.length > 0) {
        setPendingMentions(needValidation);
        setResolvedMentions(autoResolved);
        setAppState("validating");
      } else {
        buildResults(data.mentions);
      }
    } catch (e) {
      setErrorMsg(`Request failed: ${String(e)}`);
      setAppState("error");
    }
  }, [rows, feedback, uniqueStores, uniqueStyles, buildResults]);

  // Validation modal confirm
  const handleValidationConfirm = useCallback(
    (storeNumber: string, storeName: string, style: string) => {
      const [current, ...rest] = pendingMentions;
      const resolved: ExtractedMention = {
        ...current,
        matchedStoreNumber: storeNumber,
        matchedStoreName: storeName,
        matchedStyle: style,
        needsValidation: false,
      };
      const newResolved = [...resolvedMentions, resolved];
      if (rest.length === 0) {
        buildResults(newResolved);
      } else {
        setPendingMentions(rest);
        setResolvedMentions(newResolved);
      }
    },
    [pendingMentions, resolvedMentions, buildResults]
  );

  const handleValidationSkip = useCallback(() => {
    const [, ...rest] = pendingMentions;
    if (rest.length === 0) {
      buildResults(resolvedMentions);
    } else {
      setPendingMentions(rest);
    }
  }, [pendingMentions, resolvedMentions, buildResults]);

  // User submits feedback on a result card → call /api/refine → update that result
  const handleFeedback = useCallback(
    async (userFeedback: UserFeedback) => {
      setRefiningId(userFeedback.resultId);
      try {
        const res = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: userFeedback, uniqueStyles }),
        });
        const data: RefineResponse = await res.json();

        if (data.correctedStyleNumber) {
          const agg = aggregateByStyleNumber(rows, userFeedback.storeNumber, data.correctedStyleNumber);
          const correctedStyle = `${data.correctedStyleNumber} | ${agg.styleDescription}`;

          setResults((prev) =>
            prev.map((r) =>
              r.id === userFeedback.resultId
                ? {
                    ...r,
                    style: correctedStyle,
                    skusIncluded: agg.skusIncluded,
                    totalInbound: agg.totalInbound,
                    netSalesUnits: agg.netSalesUnits,
                    eopOHATPUnits: agg.eopOHATPUnits,
                    status: agg.totalInbound > 0 ? "no-action" : agg.netSalesUnits > 0 ? "action-send-stock" : "action-challenge",
                    refined: true,
                  }
                : r
            )
          );
        }
      } catch (e) {
        console.error("Refine error:", e);
      } finally {
        setRefiningId(null);
      }
    },
    [rows, uniqueStyles]
  );

  // ─── Derived ────────────────────────────────────────────────────────────────
  const isAnalyzing = appState === "analyzing";
  const canAnalyze = rows.length > 0 && feedback.trim().length > 0 && !isAnalyzing;
  const sendStockCount = results.filter((r) => r.status === "action-send-stock").length;
  const challengeCount = results.filter((r) => r.status === "action-challenge").length;
  const actionCount = sendStockCount + challengeCount;
  const okCount = results.filter((r) => r.status === "no-action").length;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Validation modal */}
      {appState === "validating" && pendingMentions.length > 0 && (
        <ValidationModal
          mention={pendingMentions[0]}
          onConfirm={handleValidationConfirm}
          onSkip={handleValidationSkip}
        />
      )}

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Allocation Discrepancy Tool</h1>
              <p className="text-xs text-slate-500">
                Cross-reference field feedback against your allocation report
              </p>
            </div>
          </div>
          {appState !== "idle" && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Input panel */}
        {appState !== "done" && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <SectionLabel number={1} label="Upload Allocation Report" />
              <FileDropzone
                onParsed={handleParsed}
                onClear={handleClear}
                hasFile={rows.length > 0}
                fileName={fileName}
              />
              {columnWarnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  {columnWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      {w.startsWith("Detected") ? `ℹ ${w}` : `⚠ ${w}`}
                    </p>
                  ))}
                </div>
              )}
              {rows.length > 0 && (
                <p className="text-xs text-slate-500">
                  Loaded {rows.length.toLocaleString()} rows · {uniqueStores.length} stores ·{" "}
                  {uniqueStyles.length} styles
                </p>
              )}
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-2">
              <SectionLabel number={2} label="Paste Field Feedback" />
              <FeedbackInput value={feedback} onChange={setFeedback} disabled={isAnalyzing} />
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-2">
              <SectionLabel number={3} label="Run Analysis" />
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {isAnalyzing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-white" />
                    Analyzing with AI…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze Feedback
                  </>
                )}
              </button>
              {!rows.length && (
                <p className="text-center text-xs text-slate-400">Upload a spreadsheet first</p>
              )}
            </div>

            {appState === "error" && errorMsg && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* Results panel */}
        {appState === "done" && results.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">
                  Analysis complete — {results.length} item{results.length !== 1 ? "s" : ""} reviewed
                </p>
                <p className="mt-0.5 text-xs text-slate-500 flex flex-wrap gap-x-2">
                  {sendStockCount > 0 && (
                    <span className="font-medium text-red-600">{sendStockCount} send stock</span>
                  )}
                  {challengeCount > 0 && (
                    <span className="font-medium text-amber-600">{challengeCount} challenge request</span>
                  )}
                  {okCount > 0 && (
                    <span className="font-medium text-emerald-600">{okCount} no action needed</span>
                  )}
                </p>
              </div>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New analysis
              </button>
            </div>

            {[...results]
              .sort((a, b) =>
                a.status === "action-required" ? -1 : b.status === "action-required" ? 1 : 0
              )
              .map((r) => (
                <ResultCard
                  key={r.id}
                  result={r}
                  onFeedback={handleFeedback}
                  feedbackPending={refiningId === r.id}
                />
              ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          All data is processed in-memory and cleared on page refresh · Powered by Claude claude-opus-4-6
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {number}
      </span>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </div>
  );
}
