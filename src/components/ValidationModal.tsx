"use client";

import { AlertTriangle, X, Check, Search } from "lucide-react";
import { useState, useMemo } from "react";
import type { ExtractedMention } from "@/lib/types";

interface ValidationModalProps {
  mention: ExtractedMention;
  allStores: Array<{ storeNumber: string; storeName: string }>;
  allStyles: string[];
  allGroups: string[]; // district names or store type names depending on scope
  onConfirm: (storeNumber: string, storeName: string, style: string) => void;
  onSkip: () => void;
}

export function ValidationModal({ mention, allStores, allStyles, allGroups, onConfirm, onSkip }: ValidationModalProps) {
  const [storeSearch, setStoreSearch] = useState(mention.rawStoreRef ?? "");
  const [styleSearch, setStyleSearch] = useState(mention.rawProductRef ?? "");
  const isGroupScope = mention.scope === "district" || mention.scope === "store-type";

  const [selectedStore, setSelectedStore] = useState<{ storeNumber: string; storeName: string } | null>(
    mention.matchedStoreNumber
      ? { storeNumber: mention.matchedStoreNumber, storeName: mention.matchedStoreName ?? mention.matchedStoreNumber }
      : null
  );
  const [selectedGroup, setSelectedGroup] = useState<string | null>(mention.matchedGroup ?? null);
  const [groupSearch, setGroupSearch] = useState(mention.matchedGroup ?? mention.rawStoreRef ?? "");
  const [groupOpen, setGroupOpen] = useState(false);

  const [selectedStyle, setSelectedStyle] = useState<string | null>(mention.matchedStyle ?? null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.toLowerCase().trim();
    const candidates = mention.candidateGroups?.length ? mention.candidateGroups : allGroups;
    if (!q) return candidates;
    return allGroups.filter((g) => g.toLowerCase().includes(q)).slice(0, 10);
  }, [groupSearch, mention.candidateGroups, allGroups]);

  const filteredStores = useMemo(() => {
    const q = storeSearch.toLowerCase().trim();
    if (!q) return mention.candidateStores;
    // Search ALL stores from the spreadsheet — not just AI candidates
    return allStores.filter(
      (s) =>
        s.storeNumber.toLowerCase().includes(q) ||
        s.storeName.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [storeSearch, mention.candidateStores, allStores]);

  const filteredStyles = useMemo(() => {
    const q = styleSearch.toLowerCase().trim();
    if (!q) return mention.candidateStyles;
    // Search ALL styles from the spreadsheet — not just AI candidates
    // Split query into words so "jacquard shirt" matches "JOSH JACQUARD SHIRT"
    const words = q.split(/\s+/).filter(Boolean);
    return allStyles
      .filter((s) => words.every((w) => s.toLowerCase().includes(w)))
      .slice(0, 20);
  }, [styleSearch, mention.candidateStyles, allStyles]);

  const canConfirm = isGroupScope
    ? selectedGroup !== null && selectedStyle !== null
    : selectedStore !== null && selectedStyle !== null;

  const handleConfirm = () => {
    if (!selectedStyle) return;
    if (isGroupScope && selectedGroup) {
      onConfirm(selectedGroup, selectedGroup, selectedStyle);
    } else if (selectedStore) {
      onConfirm(selectedStore.storeNumber, selectedStore.storeName, selectedStyle);
    }
  };

  /** Extract just the style description from "StyleNumber | StyleDescription" */
  function styleLabel(s: string) {
    return s.includes(" | ") ? s.split(" | ").slice(1).join(" | ") : s;
  }
  function styleCode(s: string) {
    return s.includes(" | ") ? s.split(" | ")[0] : null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">Clarification Needed</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              AI confidence is below 95% — please confirm the correct match.
            </p>
          </div>
          <button onClick={onSkip} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 max-h-[70vh] overflow-y-auto">
          {/* What the user said */}
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm space-y-1">
            <div className="flex gap-2">
              <span className="shrink-0 font-medium text-slate-500 w-24">Store ref:</span>
              <span className="text-slate-800">"{mention.rawStoreRef}"</span>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 font-medium text-slate-500 w-24">Product ref:</span>
              <span className="text-slate-800">"{mention.rawProductRef}"</span>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 font-medium text-slate-500 w-24">Confidence:</span>
              <span className={`font-semibold ${mention.confidence >= 0.85 ? "text-amber-600" : "text-red-600"}`}>
                {Math.round(mention.confidence * 100)}%
              </span>
            </div>
          </div>

          {/* Group picker (district / store-type scope) */}
          {isGroupScope && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Select the correct {mention.scope === "district" ? "district" : "store type"}
              </label>
              {selectedGroup ? (
                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm">
                  <Check className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium text-indigo-800">{selectedGroup}</span>
                  <button className="ml-auto text-indigo-400 hover:text-indigo-600" onClick={() => { setSelectedGroup(null); setGroupOpen(true); }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={`Search ${mention.scope === "district" ? "districts" : "store types"}…`}
                      value={groupSearch}
                      onChange={(e) => { setGroupSearch(e.target.value); setGroupOpen(true); }}
                      onFocus={() => setGroupOpen(true)}
                      className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                  {groupOpen && filteredGroups.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {filteredGroups.map((g) => (
                        <li key={g}>
                          <button
                            className="flex w-full px-4 py-2.5 text-left text-sm hover:bg-indigo-50 font-medium text-slate-800"
                            onClick={() => { setSelectedGroup(g); setGroupSearch(g); setGroupOpen(false); }}
                          >
                            {g}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Store picker (store scope only) */}
          {!isGroupScope && <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Select the correct store</label>
            {selectedStore && (
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm">
                <Check className="h-4 w-4 text-indigo-600" />
                <span className="font-medium text-indigo-800">
                  {selectedStore.storeNumber}
                  {selectedStore.storeName !== selectedStore.storeNumber && ` — ${selectedStore.storeName}`}
                </span>
                <button
                  className="ml-auto text-indigo-400 hover:text-indigo-600"
                  onClick={() => { setSelectedStore(null); setStoreOpen(true); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {!selectedStore && (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by store number or name…"
                    value={storeSearch}
                    onChange={(e) => { setStoreSearch(e.target.value); setStoreOpen(true); }}
                    onFocus={() => setStoreOpen(true)}
                    className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                {storeOpen && filteredStores.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {filteredStores.map((s) => (
                      <li key={s.storeNumber}>
                        <button
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-indigo-50"
                          onClick={() => {
                            setSelectedStore(s);
                            setStoreSearch(`${s.storeNumber} — ${s.storeName}`);
                            setStoreOpen(false);
                          }}
                        >
                          <span className="font-mono font-semibold text-slate-700">{s.storeNumber}</span>
                          <span className="text-slate-500">{s.storeName}</span>
                        </button>
                      </li>
                    ))}
                    {filteredStores.length === 0 && (
                      <li className="px-4 py-3 text-sm text-slate-400">No stores match your search.</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>}

          {/* Style picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Select the correct style</label>
            {selectedStyle && (
              <div className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm">
                <Check className="h-4 w-4 mt-0.5 text-indigo-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-indigo-800">{styleLabel(selectedStyle)}</p>
                  {styleCode(selectedStyle) && (
                    <p className="text-xs text-indigo-500 font-mono">{styleCode(selectedStyle)}</p>
                  )}
                </div>
                <button
                  className="text-indigo-400 hover:text-indigo-600 shrink-0"
                  onClick={() => { setSelectedStyle(null); setStyleOpen(true); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {!selectedStyle && (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by style name or code…"
                    value={styleSearch}
                    onChange={(e) => { setStyleSearch(e.target.value); setStyleOpen(true); }}
                    onFocus={() => setStyleOpen(true)}
                    className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                {styleOpen && filteredStyles.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {filteredStyles.map((s) => (
                      <li key={s}>
                        <button
                          className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-indigo-50"
                          onClick={() => {
                            setSelectedStyle(s);
                            setStyleSearch(styleLabel(s));
                            setStyleOpen(false);
                          }}
                        >
                          <span className="text-sm font-medium text-slate-800">{styleLabel(s)}</span>
                          {styleCode(s) && (
                            <span className="text-xs font-mono text-slate-400">{styleCode(s)}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {styleOpen && filteredStyles.length === 0 && styleSearch.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm text-slate-400">
                    No styles match — try a different search term.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Skip this mention
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Confirm match
          </button>
        </div>
      </div>
    </div>
  );
}
