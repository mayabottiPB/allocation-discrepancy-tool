"use client";

import { AlertTriangle, X, Check } from "lucide-react";
import { useState } from "react";
import type { ExtractedMention } from "@/lib/types";

interface ValidationModalProps {
  mention: ExtractedMention;
  onConfirm: (storeNumber: string, storeName: string, style: string) => void;
  onSkip: () => void;
}

export function ValidationModal({
  mention,
  onConfirm,
  onSkip,
}: ValidationModalProps) {
  const [selectedStore, setSelectedStore] = useState<string>(
    mention.matchedStoreNumber ?? ""
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(
    mention.matchedStyle ?? ""
  );

  const canConfirm = selectedStore !== "" && selectedStyle !== "";

  const handleConfirm = () => {
    const storeName =
      mention.candidateStores.find((s) => s.storeNumber === selectedStore)
        ?.storeName ?? selectedStore;
    onConfirm(selectedStore, storeName, selectedStyle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">
              Clarification Needed
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              The AI confidence is below 95% — please confirm the correct match.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Raw references */}
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="flex gap-2">
              <span className="shrink-0 font-medium text-slate-500">Store ref:</span>
              <span className="text-slate-800">"{mention.rawStoreRef}"</span>
            </div>
            <div className="mt-1 flex gap-2">
              <span className="shrink-0 font-medium text-slate-500">Product ref:</span>
              <span className="text-slate-800">"{mention.rawProductRef}"</span>
            </div>
            <div className="mt-1 flex gap-2">
              <span className="shrink-0 font-medium text-slate-500">Confidence:</span>
              <span
                className={`font-semibold ${
                  mention.confidence >= 0.85
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {Math.round(mention.confidence * 100)}%
              </span>
            </div>
          </div>

          {/* Store selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Select the correct store
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">— choose a store —</option>
              {mention.candidateStores.map((s) => (
                <option key={s.storeNumber} value={s.storeNumber}>
                  {s.storeNumber}
                  {s.storeName && s.storeName !== s.storeNumber
                    ? ` — ${s.storeName}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Style selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Select the correct style
            </label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">— choose a style —</option>
              {mention.candidateStyles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Skip this mention
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Confirm match
          </button>
        </div>
      </div>
    </div>
  );
}
