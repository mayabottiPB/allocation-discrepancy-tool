import * as XLSX from "xlsx";
import type { AllocationRow, ParsedSpreadsheet } from "./types";

// Fuzzy column name matching — returns the first key that matches any alias
function findColumn(keys: string[], aliases: string[]): string | undefined {
  const lower = keys.map((k) => k.toLowerCase().trim());
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    const idx = lower.findIndex(
      (k) => k === a || k.includes(a) || a.includes(k)
    );
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
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
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

  const storeNumberCol = findColumn(keys, [
    "store number",
    "store #",
    "store no",
    "store_number",
    "storenumber",
    "store",
    "str #",
    "str no",
  ]);
  const storeNameCol = findColumn(keys, [
    "store name",
    "store_name",
    "storename",
    "location",
    "location name",
  ]);
  const styleCol = findColumn(keys, [
    "style",
    "style name",
    "style number",
    "style no",
    "item",
    "item name",
    "product",
    "product name",
    "description",
  ]);
  const skuCol = findColumn(keys, [
    "sku",
    "upc",
    "item number",
    "item no",
    "item #",
    "color size",
    "colorsize",
  ]);
  const inboundCol = findColumn(keys, [
    "eop total units inbound",
    "eop inbound",
    "total units inbound",
    "units inbound",
    "inbound units",
    "inbound",
    "eop total inbound",
  ]);
  const salesCol = findColumn(keys, [
    "net sales units",
    "net sales",
    "sales units",
    "net units",
    "units sold",
    "sales",
  ]);
  const atpCol = findColumn(keys, [
    "eop oh atp units",
    "eop atp",
    "oh atp",
    "atp units",
    "atp",
    "on hand atp",
    "oh atp units",
    "available to purchase",
  ]);

  if (!storeNumberCol) warnings.push("Could not find a 'Store Number' column.");
  if (!styleCol) warnings.push("Could not find a 'Style' column.");
  if (!inboundCol)
    warnings.push("Could not find an 'EOP Total Units Inbound' column.");
  if (!salesCol) warnings.push("Could not find a 'Net Sales Units' column.");
  if (!atpCol) warnings.push("Could not find an 'EOP OH ATP Units' column.");

  const rows: AllocationRow[] = rawRows.map((raw) => ({
    storeNumber: toString(storeNumberCol ? raw[storeNumberCol] : ""),
    storeName: toString(storeNameCol ? raw[storeNameCol] : ""),
    style: toString(styleCol ? raw[styleCol] : ""),
    sku: toString(skuCol ? raw[skuCol] : ""),
    eopTotalUnitsInbound: toNumber(inboundCol ? raw[inboundCol] : 0),
    netSalesUnits: toNumber(salesCol ? raw[salesCol] : 0),
    eopOHATPUnits: toNumber(atpCol ? raw[atpCol] : 0),
    _raw: raw,
  }));

  // Build unique stores
  const storeMap = new Map<string, string>();
  for (const row of rows) {
    if (row.storeNumber && !storeMap.has(row.storeNumber)) {
      storeMap.set(row.storeNumber, row.storeName || row.storeNumber);
    }
  }
  const uniqueStores = Array.from(storeMap.entries()).map(
    ([storeNumber, storeName]) => ({ storeNumber, storeName })
  );

  // Build unique styles
  const styleSet = new Set<string>();
  for (const row of rows) {
    if (row.style) styleSet.add(row.style);
  }
  const uniqueStyles = Array.from(styleSet).sort();

  return { rows, uniqueStores, uniqueStyles, columnWarnings: warnings };
}

/** Compute aggregated result for a given storeNumber + style */
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
  const matching = rows.filter(
    (r) =>
      r.storeNumber === storeNumber &&
      r.style.toLowerCase() === style.toLowerCase()
  );

  const totalInbound = matching.reduce((s, r) => s + r.eopTotalUnitsInbound, 0);
  const netSalesUnits = matching.reduce((s, r) => s + r.netSalesUnits, 0);
  const eopOHATPUnits = matching.reduce((s, r) => s + r.eopOHATPUnits, 0);
  const skusIncluded = [
    ...new Set(matching.map((r) => r.sku).filter(Boolean)),
  ];
  const storeName =
    matching[0]?.storeName || storeNumber;

  return { totalInbound, netSalesUnits, eopOHATPUnits, skusIncluded, storeName };
}
