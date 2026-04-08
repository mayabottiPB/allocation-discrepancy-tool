export interface AllocationRow {
  storeNumber: string;
  storeName: string;
  style: string;
  sku: string;
  eopTotalUnitsInbound: number;
  netSalesUnits: number;
  eopOHATPUnits: number;
  /** raw row for debugging */
  _raw?: Record<string, unknown>;
}

export interface ParsedSpreadsheet {
  rows: AllocationRow[];
  uniqueStores: Array<{ storeNumber: string; storeName: string }>;
  uniqueStyles: string[];
  columnWarnings: string[];
}

/** One store+style mention extracted from feedback by Claude */
export interface ExtractedMention {
  id: string;
  rawStoreRef: string;
  rawProductRef: string;
  matchedStoreNumber: string | null;
  matchedStoreName: string | null;
  matchedStyle: string | null;
  confidence: number; // 0–1
  needsValidation: boolean;
  candidateStores: Array<{ storeNumber: string; storeName: string }>;
  candidateStyles: string[];
}

/** What Claude returns from /api/analyze */
export interface AnalyzeResponse {
  mentions: ExtractedMention[];
  error?: string;
}

/** Final result card after all validations resolved */
export interface AnalysisResult {
  id: string;
  storeNumber: string;
  storeName: string;
  style: string;
  skusIncluded: string[];
  totalInbound: number;
  netSalesUnits: number;
  eopOHATPUnits: number;
  status: "no-action" | "action-required";
}
