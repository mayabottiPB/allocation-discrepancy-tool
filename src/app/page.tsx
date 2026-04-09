"use client";

import { useState, useCallback } from "react";
import { Layers, Sparkles, RotateCcw, AlertTriangle } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FeedbackInput } from "@/components/FeedbackInput";
import { ValidationModal } from "@/components/ValidationModal";
import { ResultCard } from "@/components/ResultCard";
import { ResultGroup } from "@/components/ResultGroup";
import {
  aggregateResult,
  aggregateByStyleNumber,
  getStoresByDistrict,
  getStoresByType,
} from "@/lib/parseSpreadsheet";
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

/** Group of results fanned out from a district/store-type mention */
interface ResultGroupData {
  id: string;
  groupLabel: string;
  scope: "district" | "store-type";
  style: string;
  results: AnalysisResult[];
}

export default function Home() {
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [uniqueStores, setUniqueStores] = useState<Array<{ storeNumber: string; storeName: string }>>([]);
  const [uniqueStyles, setUniqueStyles] = useState<string[]>([]);
  const [uniqueStoreTypes, setUniqueStoreTypes] = useState<string[]>([]);
  const [uniqueDistricts, setUniqueDistricts] = useState<string[]>([]);
  const [columnWarnings, setColumnWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const [feedback, setFeedback] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingMentions, setPendingMentions] = useState<ExtractedMention[]>([]);
  const [resolvedMentions, setResolvedMentions] = useState<ExtractedMention[]>([]);

  // Single-store results
  const [results, setResults] = useState<AnalysisResult[]>([]);
  // District / store-type group results
  const [groups, setGroups] = useState<ResultGroupData[]>([]);

  const [refiningId, setRefiningId] = useState<string | null>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function computeStatus(totalInbound: number, netSalesUnits: number): AnalysisResult["status"] {
    if (totalInbound > 0) return "no-action";
    if (netSalesUnits > 0) return "action-send-stock";
    return "action-challenge";
  }

  function makeResult(
    id: string,
    storeNumber: string,
    storeName: string,
    style: string,
    groupLabel?: string
  ): AnalysisResult {
    const agg = aggregateResult(rows, storeNumber, style);
    return {
      id,
      storeNumber,
      storeName: storeName || agg.storeName,
      style,
      skusIncluded: agg.skusIncluded,
      totalInbound: agg.totalInbound,
      netSalesUnits: agg.netSalesUnits,
      eopOHATPUnits: agg.eopOHATPUnits,
      status: computeStatus(agg.totalInbound, agg.netSalesUnits),
      groupLabel,
    };
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleParsed = useCallback((parsed: ParsedSpreadsheet, name: string) => {
    setRows(parsed.rows);
    setUniqueStores(parsed.uniqueStores);
    setUniqueStyles(parsed.uniqueStyles);
    setUniqueStoreTypes(parsed.uniqueStoreTypes);
    setUniqueDistricts(parsed.uniqueDistricts);
    setColumnWarnings(parsed.columnWarnings);
    setFileName(name);
  }, []);

  const handleClear = useCallback(() => {
    setRows([]);
    setUniqueStores([]);
    setUniqueStyles([]);
    setUniqueStoreTypes([]);
    setUniqueDistricts([]);
    setColumnWarnings([]);
    setFileName(null);
  }, []);

  const reset = useCallback(() => {
    setAppState("idle");
    setErrorMsg(null);
    setPendingMentions([]);
    setResolvedMentions([]);
    setResults([]);
    setGroups([]);
    setFeedback("");
    handleClear();
  }, [handleClear]);

  const buildResults = useCallback(
    (mentions: ExtractedMention[]) => {
      const singleResults: AnalysisResult[] = [];
      const groupResults: ResultGroupData[] = [];

      for (const m of mentions) {
        if (!m.matchedStyle) continue;

        if (m.scope === "store" && m.matchedStoreNumber) {
          singleResults.push(makeResult(m.id, m.matchedStoreNumber, m.matchedStoreName ?? "", m.matchedStyle));
        } else if (m.scope === "district" && m.matchedGroup) {
          const stores = getStoresByDistrict(rows, m.matchedGroup);
          const storeResults = stores.map((s, i) =>
            makeResult(`${m.id}-${i}`, s.storeNumber, s.storeName, m.matchedStyle!, m.matchedGroup!)
          );
          groupResults.push({
            id: m.id,
            groupLabel: m.matchedGroup,
            scope: "district",
            style: m.matchedStyle,
            results: storeResults,
          });
        } else if (m.scope === "store-type" && m.matchedGroup) {
          const stores = getStoresByType(rows, m.matchedGroup);
          const storeResults = stores.map((s, i) =>
            makeResult(`${m.id}-${i}`, s.storeNumber, s.storeName, m.matchedStyle!, m.matchedGroup!)
          );
          groupResults.push({
            id: m.id,
            groupLabel: m.matchedGroup,
            scope: "store-type",
            style: m.matchedStyle,
            results: storeResults,
          });
        }
      }

      setResults(singleResults);
      setGroups(groupResults);
      setAppState("done");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  );

  const handleAnalyze = useCallback(async () => {
    if (!rows.length || !feedback.trim()) return;
    setAppState("analyzing");
    setErrorMsg(null);
    setPendingMentions([]);
    setResolvedMentions([]);
    setResults([]);
    setGroups([]);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, uniqueStores, uniqueStyles, uniqueStoreTypes, uniqueDistricts }),
      });
      const data: AnalyzeResponse = await res.json();

      if (data.error) { setErrorMsg(data.error); setAppState("error"); return; }
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
  }, [rows, feedback, uniqueStores, uniqueStyles, uniqueStoreTypes, uniqueDistricts, buildResults]);

  const handleValidationConfirm = useCallback(
    (storeNumber: string, storeName: string, style: string) => {
      const [current, ...rest] = pendingMentions;
      const resolved: ExtractedMention = {
        ...current,
        matchedStoreNumber: current.scope === "store" ? storeNumber : null,
        matchedStoreName: current.scope === "store" ? storeName : null,
        matchedGroup: current.scope !== "store" ? storeNumber : null, // reuse storeNumber field for group
        matchedStyle: style,
        needsValidation: false,
      };
      const newResolved = [...resolvedMentions, resolved];
      if (rest.length === 0) { buildResults(newResolved); }
      else { setPendingMentions(rest); setResolvedMentions(newResolved); }
    },
    [pendingMentions, resolvedMentions, buildResults]
  );

  const handleValidationSkip = useCallback(() => {
    const [, ...rest] = pendingMentions;
    if (rest.length === 0) { buildResults(resolvedMentions); }
    else { setPendingMentions(rest); }
  }, [pendingMentions, resolvedMentions, buildResults]);

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
          const updater = (r: AnalysisResult): AnalysisResult =>
            r.id !== userFeedback.resultId ? r : {
              ...r,
              style: correctedStyle,
              skusIncluded: agg.skusIncluded,
              totalInbound: agg.totalInbound,
              netSalesUnits: agg.netSalesUnits,
              eopOHATPUnits: agg.eopOHATPUnits,
              status: computeStatus(agg.totalInbound, agg.netSalesUnits),
              refined: true,
            };
          setResults((prev) => prev.map(updater));
          setGroups((prev) =>
            prev.map((g) => ({ ...g, results: g.results.map(updater) }))
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

  // ─── Derived counts ──────────────────────────────────────────────────────────
  const allResults = [
    ...results,
    ...groups.flatMap((g) => g.results),
  ];
  const sendStockCount = allResults.filter((r) => r.status === "action-send-stock").length;
  const challengeCount = allResults.filter((r) => r.status === "action-challenge").length;
  const okCount = allResults.filter((r) => r.status === "no-action").length;
  const totalItems = results.length + groups.length;
  const isAnalyzing = appState === "analyzing";
  const canAnalyze = rows.length > 0 && feedback.trim().length > 0 && !isAnalyzing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {appState === "validating" && pendingMentions.length > 0 && (
        <ValidationModal
          mention={pendingMentions[0]}
          allStores={uniqueStores}
          allStyles={uniqueStyles}
          allGroups={
            pendingMentions[0].scope === "district" ? uniqueDistricts :
            pendingMentions[0].scope === "store-type" ? uniqueStoreTypes : []
          }
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
              <p className="text-xs text-slate-500">Cross-reference field feedback against your allocation report</p>
            </div>
          </div>
          {appState !== "idle" && (
            <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>

        {/* Input panel */}
        {appState !== "done" && (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <SectionLabel number={1} label="Upload Allocation Report" />
              <FileDropzone onParsed={handleParsed} onClear={handleClear} hasFile={rows.length > 0} fileName={fileName} />
              {columnWarnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 space-y-0.5">
                  {columnWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w.startsWith("Detected") ? `ℹ ${w}` : `⚠ ${w}`}</p>
                  ))}
                </div>
              )}
              {rows.length > 0 && (
                <p className="text-xs text-slate-500">
                  Loaded {rows.length.toLocaleString()} rows · {uniqueStores.length} stores ·{" "}
                  {uniqueStyles.length} styles
                  {uniqueStoreTypes.length > 0 && ` · Types: ${uniqueStoreTypes.join(", ")}`}
                  {uniqueDistricts.length > 0 && ` · Districts: ${uniqueDistricts.join(", ")}`}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
              >
                {isAnalyzing ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-white" /> Analyzing with AI…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Analyze Feedback</>
                )}
              </button>
              {!rows.length && <p className="text-center text-xs text-slate-400">Upload a spreadsheet first</p>}
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
        {appState === "done" && (results.length > 0 || groups.length > 0) && (
          <div className="space-y-5">
            {/* Summary bar */}
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">
                  Analysis complete — {totalItems} item{totalItems !== 1 ? "s" : ""} reviewed
                </p>
                <p className="mt-0.5 text-xs text-slate-500 flex flex-wrap gap-x-2">
                  {sendStockCount > 0 && <span className="font-medium text-red-600">{sendStockCount} send stock</span>}
                  {challengeCount > 0 && <span className="font-medium text-amber-600">{challengeCount} challenge request</span>}
                  {okCount > 0 && <span className="font-medium text-emerald-600">{okCount} no action needed</span>}
                </p>
              </div>
              <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                <RotateCcw className="h-3.5 w-3.5" /> New analysis
              </button>
            </div>

            {/* Single-store results — action first */}
            {[...results]
              .sort((a, b) => a.status !== "no-action" ? -1 : b.status !== "no-action" ? 1 : 0)
              .map((r) => (
                <ResultCard key={r.id} result={r} onFeedback={handleFeedback} feedbackPending={refiningId === r.id} />
              ))}

            {/* Group results */}
            {groups.map((g) => (
              <ResultGroup
                key={g.id}
                groupLabel={g.groupLabel}
                scope={g.scope}
                style={g.style}
                results={g.results}
                onFeedback={handleFeedback}
                refiningId={refiningId}
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
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{number}</span>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </div>
  );
}
