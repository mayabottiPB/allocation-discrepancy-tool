"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileSpreadsheet, X } from "lucide-react";
import type { ParsedSpreadsheet } from "@/lib/types";
import { parseSpreadsheet } from "@/lib/parseSpreadsheet";

interface FileDropzoneProps {
  onParsed: (result: ParsedSpreadsheet, fileName: string) => void;
  onClear: () => void;
  hasFile: boolean;
  fileName: string | null;
}

export function FileDropzone({
  onParsed,
  onClear,
  hasFile,
  fileName,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext || "")) {
        setError("Please upload an .xlsx, .xls, or .csv file.");
        return;
      }
      setLoading(true);
      try {
        const buffer = await file.arrayBuffer();
        const result = parseSpreadsheet(buffer);
        onParsed(result, file.name);
      } catch (e) {
        setError(`Failed to parse file: ${String(e)}`);
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  if (hasFile && fileName) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
        <span className="flex-1 truncate text-sm font-medium text-emerald-800">
          {fileName}
        </span>
        <button
          onClick={onClear}
          className="rounded-lg p-1 text-emerald-600 transition hover:bg-emerald-100"
          title="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-slate-100"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={onInputChange}
          disabled={loading}
        />
        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
        ) : (
          <UploadCloud
            className={`h-8 w-8 ${isDragging ? "text-indigo-500" : "text-slate-400"}`}
          />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            {loading ? "Parsing spreadsheet…" : "Drop your allocation file here"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            .xlsx, .xls, or .csv · click to browse
          </p>
        </div>
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
