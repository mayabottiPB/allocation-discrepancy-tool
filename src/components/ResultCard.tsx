"use client";

import { CheckCircle, AlertCircle, Package, TrendingUp, Warehouse } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";

interface ResultCardProps {
  result: AnalysisResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const isActionRequired = result.status === "action-required";

  return (
    <div
      className={`rounded-2xl border-2 p-5 shadow-sm transition ${
        isActionRequired
          ? "border-red-200 bg-red-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
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
            <h3 className="mt-0.5 text-base font-bold text-slate-900">
              {result.style}
            </h3>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            isActionRequired
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {isActionRequired ? "Action Required" : "No Action Needed"}
        </span>
      </div>

      {/* Verdict line */}
      <p
        className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
          isActionRequired
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
      <p
        className={`text-lg font-bold ${
          highlight ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
