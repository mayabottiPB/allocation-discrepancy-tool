"use client";

import { MessageSquareText } from "lucide-react";

interface FeedbackInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function FeedbackInput({ value, onChange, disabled }: FeedbackInputProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <MessageSquareText className="h-4 w-4 text-indigo-500" />
        Field Feedback
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={`Paste transcripts or notes here.\n\nExamples:\n• "Store 42 in Toronto is running low on the Puffer-Navy — we sold 30 units last week and nothing is coming."\n• "The Blue Denim jacket at location 101 has strong velocity but no inbound showing on the allocation report."`}
        rows={8}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
      />
      <p className="text-xs text-slate-400">
        Mention store numbers/names and product style names or SKUs — the AI will extract and match them.
      </p>
    </div>
  );
}
