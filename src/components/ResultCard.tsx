"use client";

import {
  CheckCircle,
  AlertCircle,
  Package,
  TrendingUp,
  Warehouse,
  MessageSquarePlus,
  X,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCheck,
} from "lucide-react";
import { useState } from "react";
import type { AnalysisResult, UserFeedback } from "@/lib/types";

interface ResultCardProps {
  result: AnalysisResult;
  onFeedback: (feedback: UserFeedback) => void;
  feedbackPending?: boolean;
}

export function ResultCard({ result, onFeedback, feedbackPending }: ResultCardProps) {
  const isActionRequired = result.status === "action-required";
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [wrongSkus, setWrongSkus] = useState<Set<string>>(new Set());
  const [correctSkus, setCorrectSkus] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  /** Extract readable style name from "NUM | DESC" format */
  const styleDisplay = result.style.includes(" | ")
    ? result.style.split(" | ").slice(1).join(" | ")
    : result.style;
  const styleCode = result.style.includes(" | ")
    ? result.style.split(" | ")[0]
    : null;

  const toggleWrong = (sku: string) => {
    setWrongSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) { next.delete(sku); } else {
        next.add(sku);
        // Remove from correct if present
        setCorrectSkus((c) => { const cn = new Set(c); cn.delete(sku); return cn; });
      }
      return next;
    });
  };

  const toggleCorrect = (sku: string) => {
    setCorrectSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) { next.delete(sku); } else {
        next.add(sku);
        setWrongSkus((w) => { const wn = new Set(w); wn.delete(sku); return wn; });
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const feedback: UserFeedback = {
      resultId: result.id,
      storeNumber: result.storeNumber,
      storeName: result.storeName,
      originalStyle: result.style,
      originalSkus: result.skusIncluded,
      wrongSkus: Array.from(wrongSkus),
      correctSkus: Array.from(correctSkus),
      note,
    };
    onFeedback(feedback);
    setSubmitted(true);
    setFeedbackOpen(false);
  };

  const hasFeedback = wrongSkus.size > 0 || correctSkus.size > 0 || note.trim().length > 0;

  return (
    <div
      className={`rounded-2xl border-2 shadow-sm transition ${
        result.refined
          ? "border-violet-200 bg-violet-50"
          : isActionRequired
          ? "border-red-200 bg-red-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="p-5">
        {/* Card header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isActionRequired ? (
              <AlertCircle className="h-6 w-6 shrink-0 text-red-500" />
            ) : (
              <CheckCircle className="h-6 w-6 shrink-0 text-emerald-500" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Store {result.storeNumber}
                {result.storeName && result.storeName !== result.storeNumber
                  ? ` · ${result.storeName}`
                  : ""}
              </p>
              <h3 className="mt-0.5 text-base font-bold text-slate-900">{styleDisplay}</h3>
              {styleCode && (
                <p className="text-xs font-mono text-slate-400">{styleCode}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                result.refined
                  ? "bg-violet-100 text-violet-700"
                  : isActionRequired
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {result.refined ? "AI Refined" : isActionRequired ? "Action Required" : "No Action Needed"}
            </span>
          </div>
        </div>

        {/* Verdict */}
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            result.refined
              ? "bg-violet-100 text-violet-800"
              : isActionRequired
              ? "bg-red-100 text-red-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {isActionRequired
            ? `No inbound units are allocated to this store. With ${result.netSalesUnits.toLocaleString()} units sold, this location may stock out.`
            : `${result.totalInbound.toLocaleString()} unit${result.totalInbound !== 1 ? "s" : ""} inbound — allocation is in place.`}
        </p>

        {/* Metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Metric
            icon={<Package className="h-4 w-4 text-indigo-500" />}
            label="Total Inbound"
            value={result.totalInbound.toLocaleString()}
            highlight={result.totalInbound === 0}
          />
          <Metric
            icon={<TrendingUp className="h-4 w-4 text-violet-500" />}
            label="Net Sales"
            value={result.netSalesUnits.toLocaleString()}
          />
          <Metric
            icon={<Warehouse className="h-4 w-4 text-slate-500" />}
            label="OH ATP"
            value={result.eopOHATPUnits.toLocaleString()}
          />
        </div>

        {/* SKUs */}
        {result.skusIncluded.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              SKUs aggregated ({result.skusIncluded.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.skusIncluded.map((sku) => (
                <span
                  key={sku}
                  className="rounded-md bg-white px-2 py-0.5 text-xs font-mono text-slate-600 shadow-sm ring-1 ring-slate-200"
                >
                  {sku}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback toggle */}
        {!submitted && (
          <button
            onClick={() => setFeedbackOpen((v) => !v)}
            className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-700"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              {feedbackOpen ? "Hide feedback" : "Flag incorrect SKUs or give feedback to AI"}
            </span>
            {feedbackOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}

        {submitted && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
            <CheckCheck className="h-3.5 w-3.5" />
            Feedback received — AI is refining this result…
          </div>
        )}
      </div>

      {/* Feedback panel */}
      {feedbackOpen && !submitted && (
        <div className="border-t border-slate-200 bg-white/80 px-5 py-4 space-y-4 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Flag SKUs</p>
            <button onClick={() => setFeedbackOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Mark each SKU as correct or wrong. The AI will use this to find the right style.
          </p>

          {result.skusIncluded.length > 0 ? (
            <div className="space-y-2">
              {result.skusIncluded.map((sku) => (
                <div key={sku} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="font-mono text-xs font-semibold text-slate-700">{sku}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleCorrect(sku)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        correctSkus.has(sku)
                          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                          : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-600"
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      Correct
                    </button>
                    <button
                      onClick={() => toggleWrong(sku)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        wrongSkus.has(sku)
                          ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                          : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      Wrong
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No SKUs to flag — add a note below.</p>
          )}

          {/* Free-text note */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Additional note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "The wrong SKUs are MENS — I was asking about the KIDS version."'
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!hasFeedback || feedbackPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {feedbackPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-white" />
                AI is refining…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Send feedback to AI
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className={`text-lg font-bold ${highlight ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}
