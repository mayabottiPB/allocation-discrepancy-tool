"use client";

import { useState } from "react";
import { Building2, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { ResultCard } from "./ResultCard";
import type { AnalysisResult, UserFeedback } from "@/lib/types";

interface ResultGroupProps {
  groupLabel: string;
  scope: "district" | "store-type";
  style: string;
  results: AnalysisResult[];
  onFeedback: (feedback: UserFeedback) => void;
  refiningId: string | null;
}

export function ResultGroup({ groupLabel, scope, style, results, onFeedback, refiningId }: ResultGroupProps) {
  const actionCount = results.filter((r) => r.status !== "no-action").length;
  const noActionCount = results.filter((r) => r.status === "no-action").length;
  const sendStockCount = results.filter((r) => r.status === "action-send-stock").length;
  const challengeCount = results.filter((r) => r.status === "action-challenge").length;

  // Collapse no-action stores by default when there are many
  const [showNoAction, setShowNoAction] = useState(noActionCount <= 3);

  const actionResults = results.filter((r) => r.status !== "no-action");
  const noActionResults = results.filter((r) => r.status === "no-action");

  const styleDisplay = style.includes(" | ") ? style.split(" | ").slice(1).join(" | ") : style;

  return (
    <div className="space-y-3">
      {/* Group header */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          scope === "district" ? "bg-indigo-100" : "bg-violet-100"
        }`}>
          {scope === "district"
            ? <MapPin className="h-4 w-4 text-indigo-600" />
            : <Building2 className="h-4 w-4 text-violet-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {scope === "district" ? "District" : "Store Type"}
          </p>
          <p className="font-bold text-slate-900 truncate">{groupLabel} — {styleDisplay}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {results.length} store{results.length !== 1 ? "s" : ""} ·{" "}
            {sendStockCount > 0 && <span className="text-red-600 font-medium">{sendStockCount} send stock</span>}
            {sendStockCount > 0 && challengeCount > 0 && " · "}
            {challengeCount > 0 && <span className="text-amber-600 font-medium">{challengeCount} challenge</span>}
            {actionCount > 0 && noActionCount > 0 && " · "}
            {noActionCount > 0 && <span className="text-emerald-600 font-medium">{noActionCount} ok</span>}
          </p>
        </div>
      </div>

      {/* Action-required stores first */}
      {actionResults.map((r) => (
        <div key={r.id} className="pl-4 border-l-2 border-slate-200">
          <ResultCard
            result={r}
            onFeedback={onFeedback}
            feedbackPending={refiningId === r.id}
          />
        </div>
      ))}

      {/* No-action stores — collapsible when many */}
      {noActionResults.length > 0 && (
        <div className="pl-4 border-l-2 border-slate-200 space-y-3">
          {showNoAction ? (
            <>
              {noActionResults.map((r) => (
                <ResultCard
                  key={r.id}
                  result={r}
                  onFeedback={onFeedback}
                  feedbackPending={refiningId === r.id}
                />
              ))}
              {noActionResults.length > 3 && (
                <button
                  onClick={() => setShowNoAction(false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Collapse {noActionResults.length} stores with no action needed
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setShowNoAction(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Show {noActionResults.length} stores with no action needed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
