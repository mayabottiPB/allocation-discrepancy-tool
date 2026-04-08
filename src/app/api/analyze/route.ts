import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalyzeResponse, ExtractedMention } from "@/lib/types";

const client = new Anthropic();

interface AnalyzeRequestBody {
  feedback: string;
  uniqueStores: Array<{ storeNumber: string; storeName: string }>;
  uniqueStyles: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequestBody = await req.json();
    const { feedback, uniqueStores, uniqueStyles } = body;

    if (!feedback?.trim()) {
      return NextResponse.json<AnalyzeResponse>({ mentions: [] });
    }

    const storeList = uniqueStores
      .map((s) => `${s.storeNumber}${s.storeName ? ` (${s.storeName})` : ""}`)
      .join(", ");

    const styleList = uniqueStyles.join(", ");

    const systemPrompt = `You are a retail allocation analyst. Your job is to extract store and product references from field feedback text and match them to the known data.

Known Stores: ${storeList || "(none provided)"}
Known Styles: ${styleList || "(none provided)"}

For each store+product pair mentioned in the feedback:
1. Extract the raw reference the user made (e.g. "store 42", "downtown Toronto", "blue puffer").
2. Try to match it to the known stores and styles lists.
3. Assign a confidence score (0.0–1.0) reflecting how certain the match is.
   - Exact match → 1.0
   - Very likely match (slight variation, abbreviation) → 0.90–0.99
   - Possible match but ambiguous → 0.70–0.89
   - Guessing → below 0.70
4. List up to 5 candidate stores and up to 5 candidate styles that could be the match (for disambiguation).
5. If there is no plausible match in the known data, return null for matched fields with confidence 0.

Return a JSON array of objects with this exact shape:
[
  {
    "id": "<unique string, e.g. mention-1>",
    "rawStoreRef": "<what the user said about the store>",
    "rawProductRef": "<what the user said about the product>",
    "matchedStoreNumber": "<store number string or null>",
    "matchedStoreName": "<store name string or null>",
    "matchedStyle": "<style name string or null>",
    "confidence": <number 0.0–1.0>,
    "candidateStores": [{"storeNumber": "...", "storeName": "..."}, ...],
    "candidateStyles": ["style1", "style2", ...]
  }
]

Return ONLY the JSON array, no markdown, no explanation.`;

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Parse the following field feedback and extract all store+product mentions:\n\n${feedback}`,
        },
      ],
      system: systemPrompt,
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "[]";

    let mentions: ExtractedMention[] = [];
    try {
      // Strip any accidental markdown code fences
      const cleaned = rawText.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      mentions = parsed.map(
        (m: Omit<ExtractedMention, "needsValidation">) => ({
          ...m,
          needsValidation: m.confidence < 0.95,
        })
      );
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
