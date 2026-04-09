import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalyzeResponse, ExtractedMention } from "@/lib/types";

const client = new Anthropic();

interface AnalyzeRequestBody {
  feedback: string;
  uniqueStores: Array<{ storeNumber: string; storeName: string }>;
  uniqueStyles: string[];
  uniqueStoreTypes: string[];
  uniqueDistricts: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequestBody = await req.json();
    const { feedback, uniqueStores, uniqueStyles, uniqueStoreTypes, uniqueDistricts } = body;

    if (!feedback?.trim()) {
      return NextResponse.json<AnalyzeResponse>({ mentions: [] });
    }

    const storeList = uniqueStores
      .map((s) =>
        s.storeName && s.storeName !== s.storeNumber
          ? `${s.storeNumber} (${s.storeName})`
          : s.storeNumber
      )
      .join(", ");

    const MAX_STYLES = 800;
    const styleListTruncated = uniqueStyles.length > MAX_STYLES;
    const styleList = uniqueStyles.slice(0, MAX_STYLES).join("\n");

    const systemPrompt = `You are a retail allocation analyst. Extract store and product references from field feedback and match them to the known data below.

## Known Individual Stores
${storeList || "(none)"}

## Known Store Types
${uniqueStoreTypes.join(", ") || "(none)"}

## Known Store Districts
${uniqueDistricts.join(", ") || "(none)"}

## Known Styles
Each entry is "StyleNumber | StyleDescription" (or just one if only one is available).
Match user references against EITHER the style number OR the style description.
${styleList}${styleListTruncated ? "\n... (list truncated)" : ""}

## Instructions
For each store+product pair mentioned in the feedback:

1. Determine the SCOPE of the store reference:
   - "store"      → a specific store (e.g. "store 64", "Sawgrass Mills")
   - "district"   → an entire district (e.g. "the Northeast", "West Coast district")
   - "store-type" → an entire store type (e.g. "all outlets", "FP stores", "our outlet locations")

2. Extract raw store and product references.

3. Match to the known data:
   - For scope "store": match to a specific store number + name.
   - For scope "district": match to a district name from the Known Store Districts list.
   - For scope "store-type": match to a store type from the Known Store Types list.
   - For style: match to the known styles list (fuzzy/semantic matching allowed).

4. Assign confidence (0.0–1.0):
   - Exact or near-exact match → 0.95–1.0
   - Very likely but slight variation → 0.85–0.94
   - Possible but ambiguous → 0.70–0.84
   - Guessing → below 0.70

5. For matchedStyle: return the FULL entry from the known styles list (e.g. "KT0100091 | KIDS DAX BORDER STRIPE KNIT POLO").
6. For matchedGroup: return the matched district name or store type (e.g. "North East" or "Outlet"). Leave null for scope "store".
7. For matchedStoreNumber / matchedStoreName: only set for scope "store". Leave null otherwise.
8. candidateGroups: up to 5 most likely district or store-type matches (for disambiguation when scope is district/store-type).
9. candidateStores: up to 5 most likely individual stores (for scope "store" only).
10. candidateStyles: up to 8 most likely style matches.

Return ONLY a JSON array — no markdown, no explanation:
[
  {
    "id": "mention-1",
    "rawStoreRef": "<what user said about the store/district/type>",
    "rawProductRef": "<what user said about the product>",
    "scope": "<store|district|store-type>",
    "matchedStoreNumber": "<Location ID or null>",
    "matchedStoreName": "<Location Name or null>",
    "matchedGroup": "<district or store-type name, or null>",
    "matchedStyle": "<full style entry from known list or null>",
    "confidence": <0.0–1.0>,
    "candidateStores": [{"storeNumber": "...", "storeName": "..."}, ...],
    "candidateGroups": ["...", ...],
    "candidateStyles": ["...", ...]
  }
]`;

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Parse this field feedback and extract all store+product mentions:\n\n${feedback}`,
        },
      ],
      system: systemPrompt,
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "[]";

    let mentions: ExtractedMention[] = [];
    try {
      const cleaned = rawText
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      mentions = parsed.map((m: Omit<ExtractedMention, "needsValidation">) => ({
        ...m,
        scope: m.scope ?? "store",
        candidateGroups: m.candidateGroups ?? [],
        needsValidation: m.confidence < 0.95,
      }));
    } catch {
      return NextResponse.json<AnalyzeResponse>(
        { mentions: [], error: "AI returned unparseable response." },
        { status: 200 }
      );
    }

    return NextResponse.json<AnalyzeResponse>({ mentions });
  } catch (err) {
    console.error("[/api/analyze]", err);
    return NextResponse.json<AnalyzeResponse>(
      { mentions: [], error: String(err) },
      { status: 500 }
    );
  }
}
