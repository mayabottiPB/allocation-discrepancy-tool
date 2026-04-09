export interface AllocationRow {
  storeNumber: string;
  storeName: string;
  storeType: string;     // e.g. "Outlet", "FP Stores", "eComm"
  storeDistrict: string; // e.g. "North East", "West Coast"
  /** Style Description — human-readable, used for display and AI matching */
  style: string;
  /** Style Number — the code (e.g. B0U014CRPC), used as grouping key */
  styleNumber: string;
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
  uniqueStoreTypes: string[];
  uniqueDistricts: string[];
  columnWarnings: string[];
}

/** One store+style mention extracted from feedback by Claude */
export interface ExtractedMention {
  id: string;
  rawStoreRef: string;
  rawProductRef: string;
  /**
   * "store"      → single store reference
   * "district"   → an entire store district (e.g. "North East")
   * "store-type" → an entire store type (e.g. "Outlets", "FP Stores")
   */
  scope: "store" | "district" | "store-type";
  matchedStoreNumber: string | null;   // only set when scope === "store"
  matchedStoreName: string | null;
  matchedGroup: string | null;         // district name or store type when scope !== "store"
  matchedStyle: string | null;
  confidence: number; // 0–1
  needsValidation: boolean;
  candidateStores: Array<{ storeNumber: string; storeName: string }>;
  candidateGroups: string[];           // candidate districts or store types
  candidateStyles: string[];
}

/** What Claude returns from /api/analyze */
export interface AnalyzeResponse {
  mentions: ExtractedMention[];
  error?: string;
}

/** Final result card after all validations resolved */
export interface AnalysisResult {
  /** When this result was fanned out from a district/store-type mention */
  groupLabel?: string;
  id: string;
  storeNumber: string;
  storeName: string;
  style: string;
  skusIncluded: string[];
  totalInbound: number;
  netSalesUnits: number;
  eopOHATPUnits: number;
  /**
   * no-action          → Inbound > 0. Stock is on its way.
   * action-send-stock  → Inbound = 0 AND Net Sales > 0. Store is selling but nothing coming — allocate more.
   * action-challenge   → Inbound = 0 AND Net Sales = 0. Store is requesting stock they aren't selling — push back.
   */
  status: "no-action" | "action-send-stock" | "action-challenge";
  /** Set after user submits feedback and AI refines the result */
  refined?: boolean;
}

/** User feedback on a result card's SKU accuracy */
export interface UserFeedback {
  resultId: string;
  storeNumber: string;
  storeName: string;
  originalStyle: string;
  originalSkus: string[];
  wrongSkus: string[];
  correctSkus: string[];
  note: string;
}

/** What the refine API returns */
export interface RefineResponse {
  correctedStyleNumber: string | null;
  correctedStyleDescription: string | null;
  explanation: string;
  error?: string;
}
