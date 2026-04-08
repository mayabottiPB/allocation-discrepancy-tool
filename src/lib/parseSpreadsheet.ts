import * as XLSX from "xlsx";
import type { AllocationRow, ParsedSpreadsheet } from "./types";

/**
 * Find a column by matching aliases against the actual header keys.
 * Priority order:
 *   1. Exact match (case-insensitive)
 *   2. Header contains the alias as a substring
 * We deliberately do NOT do alias.includes(header) to avoid false positives
 * (e.g. "store name" incorrectly matching "store type").
 */
function findColumn(keys: string[], aliases: string[]): string | undefined {
  const lower = keys.map((k) => k.toLowerCase().trim());

  // Pass 1 — exact match
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    const idx = lower.indexOf(a);
    if (idx !== -1) return keys[idx];
  }

  // Pass 2 — header contains alias as substring
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    const idx = lower.findIndex((k) => k.includes(a));
    if (idx !== -1) return keys[idx];
  }

  return undefined;
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toString(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

export function parseSpreadsheet(buffer: ArrayBuffer): ParsedSpreadsheet {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellText: false, // don't pre-format numbers as text
    cellDates: false,
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true, // return raw underlying values (handles inlineStr correctly)
  });

  if (rawRows.length === 0) {
    return {
      rows: [],
      uniqueStores: [],
      uniqueStyles: [],
      columnWarnings: ["Spreadsheet appears to be empty."],
    };
  }

  const keys = Object.keys(rawRows[0]);
  const warnings: string[] = [];

  // ── Column detection ────────────────────────────────────────────────────────
  // Aliases are tried in order; first exact match wins, then substring match.
  // Put the EXACT header names from the known report format first.

  const storeNumberCol = findColumn(keys, [
    "Location ID",       // exact header in the Allocation report
    "location id",
    "Store Number",
    "store number",
    "store #",
    "store no",
  ]);

  const storeNameCol = findColumn(keys, [
    "Location Name",     // exact header in the Allocation report
    "location name",
    "Store Name",
    "store name",
  ]);

  const styleDescCol = findColumn(keys, [
    "Style Description", // exact header — human-readable, used for AI matching
    "style description",
    "Item Description",
    "item description",
    "Product Name",
    "product name",
  ]);

  const styleNumberCol = findColumn(keys, [
    "Style Number",      // exact header — the code (e.g. KT0100091)
    "style number",
    "Style No",
    "style no",
  ]);

  const skuCol = findColumn(keys, [
    "CC",                // exact header in the Allocation report (colour-size code)
    "SKU",
    "sku",
    "UPC",
    "upc",
  ]);

  const inboundCol = findColumn(keys, [
    "EOP Total Units Inbound",
    "eop total units inbound",
    "Total Units Inbound",
    "total units inbound",
  ]);

  const salesCol = findColumn(keys, [
    "Net Sales Units",
    "net sales units",
    "Net Sales",
    "net sales",
  ]);

  const atpCol = findColumn(keys, [
    "EOP OH ATP Units",
    "eop oh atp units",
    "OH ATP Units",
    "oh atp units",
    "ATP Units",
    "atp units",
  ]);

  // ── Warnings ────────────────────────────────────────────────────────────────
  if (!storeNumberCol) warnings.push(`Could not find Store/Location ID column. Headers found: ${keys.join(", ")}`);
  if (!storeNameCol)   warnings.push(`Could not find Store/Location Name column.`);
  if (!styleDescCol && !styleNumberCol) warnings.push(`Could not find Style Description or Style Number column.`);
  if (!inboundCol)     warnings.push(`Could not find 'EOP Total Units Inbound' column.`);
  if (!salesCol)       warnings.push(`Could not find 'Net Sales Units' column.`);
  if (!atpCol)         warnings.push(`Could not find 'EOP OH ATP Units' column.`);

  // Debug info — always show what was detected
  warnings.push(
    `Detected columns → Store#: "${storeNumberCol ?? "none"}" | StoreName: "${storeNameCol ?? "none"}" | StyleDesc: "${styleDescCol ?? "none"}" | StyleNum: "${styleNumberCol ?? "none"}" | Inbound: "${inboundCol ?? "none"}" | Sales: "${salesCol ?? "none"}"`
  );

  // ── Row mapping ─────────────────────────────────────────────────────────────
  const rows: AllocationRow[] = rawRows.map((raw) => {
    const styleDesc = toString(styleDescCol ? raw[styleDescCol] : "");
    const styleNum  = toString(styleNumberCol ? raw[styleNumberCol] : "");
    // Prefer the human-readable description for display and AI matching
    const style = styleDesc || styleNum;

    return {
      storeNumber:          toString(storeNumberCol ? raw[storeNumberCol] : ""),
      storeName:            toString(storeNameCol   ? raw[storeNameCol]   : ""),
      style,
      styleNumber:          styleNum,
      sku:                  toString(skuCol ? raw[skuCol] : ""),
      eopTotalUnitsInbound: toNumber(inboundCol ? raw[inboundCol] : 0),
      netSalesUnits:        toNumber(salesCol   ? raw[salesCol]   : 0),
      eopOHATPUnits:        toNumber(atpCol     ? raw[atpCol]     : 0),
      _raw: raw,
    };
  });

  // ── Unique stores ───────────────────────────────────────────────────────────
  const storeMap = new Map<string, string>();
  for (const row of rows) {
    if (row.storeNumber && !storeMap.has(row.storeNumber)) {
      storeMap.set(row.storeNumber, row.storeName || row.storeNumber);
    }
  }
  const uniqueStores = Array.from(storeMap.entries()).map(
    ([storeNumber, storeName]) => ({ storeNumber, storeName })
  );

  // ── Unique styles ────────────────────────────────────────────────────────────
  // Store as "StyleNumber | StyleDescription" so Claude can match on either.
  const styleSet = new Set<string>();
  for (const row of rows) {
    if (row.style || row.styleNumber) {
      const label = row.styleNumber && row.style && row.styleNumber !== row.style
        ? `${row.styleNumber} | ${row.style}`
        : row.style || row.styleNumber;
      styleSet.add(label);
    }
  }
  const uniqueStyles = Array.from(styleSet).sort();

  return { rows, uniqueStores, uniqueStyles, columnWarnings: warnings };
}

/**
 * Aggregate all CC/SKU rows for a given store + style.
 * Matches on style description OR style number.
 */
export function aggregateResult(
  rows: AllocationRow[],
  storeNumber: string,
  style: string
): {
  totalInbound: number;
  netSalesUnits: number;
  eopOHATPUnits: number;
  skusIncluded: string[];
  storeName: string;
} {
  const styleLower = style.toLowerCase();
  const matching = rows.filter(
    (r) =>
      r.storeNumber === storeNumber &&
      (
        r.style.toLowerCase() === styleLower ||
        r.styleNumber.toLowerCase() === styleLower ||
        // also match if the incoming style is a "Number | Description" pair
        `${r.styleNumber} | ${r.style}`.toLowerCase() === styleLower ||
        r.style.toLowerCase().includes(styleLower) ||
        styleLower.includes(r.style.toLowerCase()) && r.style.length > 5
      )
  );

  const totalInbound  = matching.reduce((s, r) => s + r.eopTotalUnitsInbound, 0);
  const netSalesUnits = matching.reduce((s, r) => s + r.netSalesUnits, 0);
  const eopOHATPUnits = matching.reduce((s, r) => s + r.eopOHATPUnits, 0);
  const skusIncluded  = [...new Set(matching.map((r) => r.sku).filter(Boolean))];
  const storeName     = matching[0]?.storeName || storeNumber;

  return { totalInbound, netSalesUnits, eopOHATPUnits, skusIncluded, storeName };
}
