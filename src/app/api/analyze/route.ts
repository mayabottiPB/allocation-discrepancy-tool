import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalyzeResponse, ExtractedMention } from "@/lib/types";

const client = new Anthropic();

interface AnalyzeRequestBody {
  feedback: string;
  uniqueStores: Array<{ storeNumber: string; storeName: string }>;
  uniqueStyles: string[]; // format: "StyleNumber | StyleDescription" or just one of them
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequestBody = await req.json();
    const { feedback, uniqueStores, uniqueStyles } = body;

    if (!feedback?.trim()) {
      return NextResponse.json<AnalyzeResponse>({ mentions: [] });
    }

    // Build store list — show both ID and name
    const storeList = uniqueStores
      .map((s) =>
        s.storeName && s.storeName !== s.storeNumber
          ? `${s.storeNumber} (${s.storeName})`
          : s.storeNumber
      )
      .join(", ");

    // Cap style list to avoid overwhelming the context window.
    // Styles are in "StyleNumber | StyleDescription" format — Claude can match on either.
    const MAX_STYLES = 800;
    const styleListTruncated = uniqueStyles.length > MAX_STYLES;
    const styleList = uniqueStyles.slice(0, MAX_STYLES).join("\n");

    const systemPrompt = `You are a retail allocation analyst. Extract store and product references from field feedback and match them to the known data below.

## Known Stores
${storeList || "(none)"}

## Known Styles
Each entry is "StyleNumber | StyleDescription" (or just one if only one is available).
Match user references against EITHER the style number OR the style description.
${styleList}${styleListTruncated ? "\n... (list truncated, match from above)" : ""}

## Instructions
For each store+product pair mentioned in the feedback:
1. Extract the raw store reference and raw product reference.
2. Match to the known lists above. Use fuzzy/semantic matching — the user may say a shortened or slightly different name.
3. Assign confidence (0.0–1.0):
   - Exact or near-exact match → 0.95–1.0
   - Very likely but slight variation → 0.85–0.94
   - Possible but ambiguous → 0.70–0.84
   - Guessing → below 0.70
4. For matchedStyle: return the FULL entry from the known styles list (e.g. "KT0100091 | KIDS DAX BORDER STRIPE KNIT POLO"), NOT a paraphrased version.
5. For matchedStoreNumber: return the Location ID (e.g. "068").
6. For matchedStoreName: return the Location Name (e.g. "Wrentham Outlets").
7. candidateStores: list up to 5 most likely store matches from the known stores.
8. candidateStyles: list up to 8 most likely style matches from the known styles list.

Return ONLY a JSON array — no markdown, no explanation:
[
  {
    "id": "mention-1",
    "rawStoreRef": "<what user said about store>",
    "rawProductRef": "<what user said about product>",
    "matchedStoreNumber": "<Location ID or null>",
    "matchedStoreName": "<Location Name or null>",
    "matchedStyle": "<full style entry from known list or null>",
    "confidence": <0.0–1.0>,
    "candidateStores": [{"storeNumber": "...", "storeName": "..."}, ...],
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
        // Strip the "StyleNumber | " prefix from matchedStyle for cleaner display
        // but keep it as-is so aggregateResult can match on it
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
